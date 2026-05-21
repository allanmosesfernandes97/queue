# Rung 4 — Redis + BullMQ (the production pattern)

## The concept

Move the queue out of your Node process into a separate program: **Redis**. Now any process on the machine can put things into the queue and any other process can pull them out. The Next.js server becomes a pure producer. A **separate worker script** becomes the consumer. Kill either one — the other keeps doing its job.

You also get, mostly for free:
- **Retries with exponential backoff** — when a job throws, BullMQ requeues it with a growing delay.
- **Dead letter queue (DLQ)** — after N attempts, the job lands in the `failed` set and stops retrying.
- **Rate limiting** — cap the queue to e.g. 5 jobs/sec to avoid hammering downstream services.
- **Progress** — `job.updateProgress(percent)` syncs through Redis to whoever is polling.
- **Horizontal scaling** — run N workers, they split the load. (You'll prove this locally.)

This rung doesn't introduce new concepts so much as it **operationalizes** rung 3. The vocabulary is what matters now.

## Mental model

**Rung 3's queue was a JavaScript `Array` living in one Node process.** Rung 4 swaps that array for **a queue that lives in a separate program (Redis) that any process can talk to.** That's the whole conceptual change. BullMQ wraps Redis so you write JavaScript, not Redis commands.

## What you build

- **`lib/redis.ts`** — a singleton `ioredis` connection. (Stash on `globalThis` for HMR, same trick as rung 3.) Critical option: when the connection is shared with a `Worker`, you must set `maxRetriesPerRequest: null`. (BullMQ requires this. If you forget, the worker will throw a clear error message.)
- **`lib/bullmq-queue.ts`** — a singleton `Queue` instance bound to a queue name (e.g. `"rung-4-resize"`).
- **`app/rung-4-bullmq/api/jobs/route.ts`** — POST handler. Builds a payload (you'll base64-encode the image bytes into the job data; for the lesson, this is fine; in prod you'd upload to blob storage and pass a key). Calls `queue.add(name, payload, opts)` where `opts` includes:
  - `jobId: yourUUID` (so the client gets a predictable receipt)
  - `attempts: 3`
  - `backoff: { type: "exponential", delay: 1000 }`
  - `removeOnComplete: { age: 3600, count: 100 }` (housekeeping — don't grow forever)
  - `removeOnFail: { age: 86400 }`
- **Status GET** — `queue.getJob(id)` returns a job (or undefined). On the job, look at: `job.getState()` (returns `waiting | active | completed | failed | delayed`), `job.progress`, `job.attemptsMade`, `job.returnvalue` (set after success), `job.failedReason`.
- **`workers/rung-4-worker.ts`** — a *standalone* TS file you run with `pnpm tsx workers/rung-4-worker.ts`. It:
  1. Creates its own `IORedis` connection (or imports the singleton).
  2. Instantiates a `new Worker(queueName, processor, { connection, concurrency, limiter })`.
  3. The processor function: read `job.data`, decode, resize, call `job.updateProgress(p)` as you go, return `{ resultDataUrl }` (the return value goes into `job.returnvalue`).
  4. Attach event listeners: `worker.on("completed", ...)`, `worker.on("failed", ...)`, `worker.on("ready", ...)`. Log to console so you can watch from the second terminal.
  5. Handle `SIGINT`/`SIGTERM` to `worker.close()` cleanly.
- **Page** — same shape as rung 3, plus a count display of `waiting / active / completed / failed / delayed` from `queue.getJobCounts(...)`.

Add to `package.json` scripts: `"worker": "tsx --env-file=.env.local workers/rung-4-worker.ts"`.

## `.env.local`

```
REDIS_URL=redis://localhost:6379
RUNG4_CONCURRENCY=3
RUNG4_RATE_PER_SEC=5
FAIL_RATE=0
```

Read these in the worker script. Restart the worker to change them. (Next.js reads `.env.local` automatically; the worker reads it because you passed `--env-file`.)

## The six verification scenarios (these are the lessons)

Run **two terminals**: `pnpm dev` and `pnpm worker`. When all six produce no surprise, you've internalized the model.

1. **Survives API crash.** Submit 10 jobs. Ctrl-C the dev server. Restart it. Jobs keep processing in the worker terminal. → The queue isn't in Next.js anymore.
2. **Survives worker crash.** Submit 10 jobs. Ctrl-C the worker. Jobs sit in `waiting`. Restart the worker. They resume. → The queue isn't in the worker either; it's in Redis.
3. **Retry with backoff.** Stop the worker. Start it again with `FAIL_RATE=0.7 pnpm worker`. Submit jobs. Watch attempts climb 1 → 2 → 3 with growing delays between, then either succeed or land in `failed`.
4. **DLQ.** Same as #3 but with `FAIL_RATE=1`. After 3 attempts, jobs go to `failed`. The `failed` count goes up. They stop retrying. → That's what a dead-letter queue is. The job is parked, not retried, waiting for human judgment.
5. **Rate limit.** Stop the worker. `RUNG4_RATE_PER_SEC=2 pnpm worker`. Submit 30 jobs. Watch them drip out at 2/second regardless of how many you have queued. → This is how you protect a fragile downstream from a burst.
6. **Horizontal scaling.** Run `pnpm worker` in *two* terminals at once. Submit 20 jobs. Both terminals print `active`/`completed` lines, splitting the work between them. → Same code, two processes, doubled throughput. This is the entire concept of "horizontal scaling" you've been hearing for years.

After #6, sit with it for a moment. *This is what every "we use a job queue" team is doing.* The vocabulary stops being intimidating.
