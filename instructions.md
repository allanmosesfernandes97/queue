# Queue School — A 4-Rung Learning Guide (you build it)

## Context

You're a frontend engineer aiming for staff. The "polling / jobs / queues" cluster of patterns shows up everywhere in real systems but is invisible until you've built one. The intimidation is mostly vocabulary — the mechanics are simple once you've felt the failure modes that motivate each pattern.

You build **one project** that climbs four rungs. Each rung works, breaks in a specific way, and that breakage is the *whole point* — it tells you why the next rung exists. You are not aiming for production polish; you are aiming for **a mental model that survives any framework choice**.

Stack: **Node + Next.js**, **image resize** as the simulated work, **Redis in Podman** as the queue backend on rung 4.

This guide is concepts, signposts, and verification checkpoints — **no code**. You write every line. When you get stuck, search the official docs of whichever piece you're using; the API surface you need is tiny and named explicitly below.

---

## What you are NOT learning here

- **Redis itself.** A black box. You start it, BullMQ talks to it, you never write a Redis command. Resist the urge to read Redis docs.
- **`sharp`'s API surface.** One method chain: open → resize → output. Don't fall into image-processing land.
- **BullMQ's full feature set.** You'll use ~6 things. It has dozens. Ignore the rest.
- **Deployment, scaling, monitoring stacks.** All local-dev.

When a new noun appears that isn't in the lesson goal, the default is: *"I will use this without understanding it deeply, and that is correct."*

---

## Rung 0 — Setup (mechanical, get through it fast)

**Goal:** A Next.js app with the right deps installed, and Redis running in Podman.

**Steps:**

1. `pnpm create next-app@latest queue-school` — accept TypeScript, ESLint, Tailwind, App Router, no `src/`, default import alias.
2. `cd queue-school && pnpm add sharp bullmq ioredis zod`.
3. `pnpm add -D tsx` (so you can run a standalone TS worker script later).
4. `podman run -d --name queue-school-redis -p 6379:6379 redis:7-alpine`.
5. Verify: `pnpm dev`, see the default Next page. `podman ps`, see Redis running.

**Done when:** Next page loads on localhost:3000, Redis container is up.

---

## Rung 1 — Synchronous

### The concept

HTTP request → server does work → HTTP response. The client waits with the connection open. This is the only pattern most people know and it works fine for fast work. The whole rest of this project is what to do when "fast" stops being true.

### What you build

- **One route handler** at `app/rung-1-sync/api/resize/route.ts` (POST). It accepts a file upload as `multipart/form-data`, calls sharp to resize, returns the resized JPEG bytes with `Content-Type: image/jpeg`.
- **One client page** at `app/rung-1-sync/page.tsx` with a file input + submit. Show the wall-clock seconds elapsed while you wait.

### Make the work feel slow

Real image resize on small files is fast. You need to *feel* the pain. In your route handler, `await` a `setTimeout` for ~8 seconds before doing the real sharp work. This simulates a CPU-heavy job (video transcode, AI inference, etc.).

### Pointers (don't copy, look up)

- Next.js App Router route handlers: `export async function POST(request: Request)`. Use `request.formData()` to get the file.
- sharp basics: `sharp(buffer).resize(W, H, { fit: "inside" }).jpeg().toBuffer()`.
- `export const runtime = "nodejs"` at the top of the route file — sharp needs Node, not Edge.

### Verify you've felt the pain

- [ ] Upload a 1–5MB image. Tab spins for ~8 seconds. No progress, no feedback, no cancel.
- [ ] Open a second tab and submit. Both stall — same Node process is busy.
- [ ] Submit, then close the tab during the wait. Server keeps doing the work for nobody. (Add a `console.log` at the end of the handler so you see it.)
- [ ] Note: in production behind Vercel / CloudFront, a 30s job dies at the edge before sharp finishes. That's a real bug, not a hypothetical.

### The lesson

HTTP request/response was not built to hold the connection for long work. Everything from here is variations on "send a receipt now, deliver the result later."

---

## Rung 2 — Submit + Poll (the receipt pattern)

### The concept

Decouple "I asked for work" from "the work is done." The POST returns immediately with a **job ID** (a receipt). The work runs in the background on the server. The client polls a status endpoint until the job is done, then renders the result.

This is the rung where the whole mental model shifts. Everything afterward is a refinement.

### What you build

- **State store**: an in-memory `Map<jobId, JobState>` in `lib/store-rung-2.ts`. `JobState` has at least `id`, `status: "pending" | "processing" | "done" | "failed"`, `progress: number`, `resultDataUrl?: string`, `error?: string`.
- **POST route** `app/rung-2-poll/api/jobs/route.ts`: parse the file, generate a UUID, insert a `"pending"` entry into the store, **fire-and-forget** the actual work (don't `await` it), return `{ jobId }` with HTTP 202.
- **GET route** `app/rung-2-poll/api/jobs/[id]/route.ts`: read from the store, return current state.
- **Client page**: submit form → kick off poll loop with `setInterval` at 1s → render progress bar → when status is `"done"`, show the result image.

### The two non-obvious bits

1. **Fire-and-forget** — your POST handler should call the work function *without `await`* (a common pattern: `void doWork(id, buffer)`). The handler returns, the work continues. This only works because Node.js will keep your async function running after the response is sent.

2. **Progress reporting** — to fake progress, break the 8-second fake delay into ~10 ticks, each updating the job's `progress` field. Your sharp call at the end goes from 90 → 100. This is the same shape real progress takes (long phases + a final cap).

3. **Return the image** — easiest path: when work is done, encode the result as base64 and stuff it into `resultDataUrl: data:image/jpeg;base64,...`. The GET endpoint returns this as part of the JSON. The client renders `<img src={resultDataUrl} />`. (In production you'd put the image in blob storage and return a URL. For this lesson, inline.)

### Pointers

- `crypto.randomUUID()` from `node:crypto`.
- Next.js dynamic route param: the second arg of GET has `{ params: Promise<{ id: string }> }` — **`params` is a Promise in modern Next.js**. You must `await` it.
- HTTP 202 = "Accepted, processing." Use this for the POST response. (Status codes are a real part of the API contract; using 200 here is technically wrong.)
- `setInterval` in a React `useEffect` — remember to clear it on unmount and when the job reaches a terminal state.

### Verify the lesson lands

- [ ] **The "oh" moment:** submit a job, copy the job ID from the response, close the browser tab, open a new tab, navigate to a tiny form on the same page where you can paste a job ID and start polling — the work ran on the server while no client was watching. Build this. It's the whole point.
- [ ] Submit 10 jobs in quick succession. All 10 run in parallel — no concurrency control, no backpressure. CPU pins.
- [ ] Ctrl-C the dev server. Restart with `pnpm dev`. Try to poll the previous job — gone. State lived in `process.memory`. This is fine for the lesson but fatal in production.

### The lesson

The job ID is a receipt. The server doesn't need the client to be present to do the work. The polling endpoint is how the client checks in. **Almost every async-job system in the world boils down to: receipt + status endpoint + result delivery.** The differences are where you store the state and who runs the work.

---

## Rung 3 — Producer/Consumer with explicit worker

### The concept

In rung 2, your "worker" was just an `async` function called inside the POST handler. There was no real *queue* — every submitted job started immediately. That's why CPU pinned.

In rung 3 you separate three things that were tangled together:
- **Producer** — the code that creates work (your POST handler). It only adds to a queue.
- **Queue** — a data structure that holds pending work (an in-memory array).
- **Consumer / worker** — code that pulls items off the queue and processes them, with a **concurrency limit**.

This split is the mental skeleton of every queueing system you'll ever see — Sidekiq, Celery, BullMQ, SQS+Lambda, RabbitMQ, Kafka consumers. The substrate changes; the shape doesn't.

### What you build

- **`lib/queue-rung-3.ts`** — exports:
  - An array of pending jobs (just `Array<{ id, input }>`).
  - A `Map<id, JobState>` for status (same shape as rung 2).
  - An `enqueue(id, input)` function the producer calls.
  - A `getJob(id)` for the status endpoint.
  - A `stats()` function returning `{ pending, active, concurrency }`.
  - A **worker loop** that processes jobs with a concurrency cap.
- POST and GET routes — same shape as rung 2, but the POST only calls `enqueue` and returns. The work logic is no longer in the route handler.
- Page — same as rung 2 but with a "submit N copies" input, and a live readout of `{ pending, active, concurrency }`. Watching that readout is the lesson.

### Hand-roll the concurrency limit (don't reach for a library yet)

You want to limit *active* jobs to N at any time. Pseudocode of the shape:

> Keep an `active` counter. A `tick()` function: while `active < CONCURRENCY` and there's a pending job, take one off the front, increment `active`, kick off processing, and when it finishes, decrement `active` and call `tick()` again. Call `tick()` whenever someone enqueues.

This is ~15 lines. You'll write it yourself. You'll understand semaphores after.

Why hand-roll instead of `p-limit`? Because the lesson is *what concurrency control is*, not *how to import it*. Once you've written it once, you'll recognize it everywhere — Go's `semaphore.Weighted`, Python's `asyncio.Semaphore`, Java's `Executor`, BullMQ's `concurrency` option.

### HMR gotcha (worth knowing about, not worth fearing)

Next.js dev mode reloads modules on file change. If you store the queue in a module-level variable, every reload resets it. Fix by stashing on `globalThis` (the standard Prisma-in-Next pattern). One-time learning, do it once, move on.

### Make concurrency configurable

Read `RUNG3_CONCURRENCY` from `process.env`, default 2. The point is that concurrency is now a **knob** instead of a side effect of however many parallel requests happen to come in.

### Verify the lesson lands

- [ ] Submit 10 copies of a job. The page should show `active: 2, pending: 8` (or whatever your concurrency is), and the pending count tick down as workers free up.
- [ ] Restart with `RUNG3_CONCURRENCY=5 pnpm dev`. Throughput visibly goes up.
- [ ] Kill the dev server mid-batch. *All* pending work is gone. Active work that hadn't written to the result store is also gone. This is the pain rung 4 fixes.

### The lesson

Producer/consumer separation is the heart of every queueing system. Once you've split them, **concurrency becomes a configuration**, not a side effect. The next limitation isn't conceptual — it's that one process is a hard ceiling and a crash wipes the queue.

---

## Rung 4 — Redis + BullMQ (the production pattern)

### The concept

Move the queue out of your Node process into a separate program: **Redis**. Now any process on the machine can put things into the queue and any other process can pull them out. The Next.js server becomes a pure producer. A **separate worker script** becomes the consumer. Kill either one — the other keeps doing its job.

You also get, mostly for free:
- **Retries with exponential backoff** — when a job throws, BullMQ requeues it with a growing delay.
- **Dead letter queue (DLQ)** — after N attempts, the job lands in the `failed` set and stops retrying.
- **Rate limiting** — cap the queue to e.g. 5 jobs/sec to avoid hammering downstream services.
- **Progress** — `job.updateProgress(percent)` syncs through Redis to whoever is polling.
- **Horizontal scaling** — run N workers, they split the load. (You'll prove this locally.)

This rung doesn't introduce new concepts so much as it **operationalizes** rung 3. The vocabulary is what matters now.

### Mental model

**Rung 3's queue was a JavaScript `Array` living in one Node process.** Rung 4 swaps that array for **a queue that lives in a separate program (Redis) that any process can talk to.** That's the whole conceptual change. BullMQ wraps Redis so you write JavaScript, not Redis commands.

### What you build

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

### `.env.local`

```
REDIS_URL=redis://localhost:6379
RUNG4_CONCURRENCY=3
RUNG4_RATE_PER_SEC=5
FAIL_RATE=0
```

Read these in the worker script. Restart the worker to change them. (Next.js reads `.env.local` automatically; the worker reads it because you passed `--env-file`.)

### The six verification scenarios (these are the lessons)

Run **two terminals**: `pnpm dev` and `pnpm worker`. When all six produce no surprise, you've internalized the model.

1. **Survives API crash.** Submit 10 jobs. Ctrl-C the dev server. Restart it. Jobs keep processing in the worker terminal. → The queue isn't in Next.js anymore.
2. **Survives worker crash.** Submit 10 jobs. Ctrl-C the worker. Jobs sit in `waiting`. Restart the worker. They resume. → The queue isn't in the worker either; it's in Redis.
3. **Retry with backoff.** Stop the worker. Start it again with `FAIL_RATE=0.7 pnpm worker`. Submit jobs. Watch attempts climb 1 → 2 → 3 with growing delays between, then either succeed or land in `failed`.
4. **DLQ.** Same as #3 but with `FAIL_RATE=1`. After 3 attempts, jobs go to `failed`. The `failed` count goes up. They stop retrying. → That's what a dead-letter queue is. The job is parked, not retried, waiting for human judgment.
5. **Rate limit.** Stop the worker. `RUNG4_RATE_PER_SEC=2 pnpm worker`. Submit 30 jobs. Watch them drip out at 2/second regardless of how many you have queued. → This is how you protect a fragile downstream from a burst.
6. **Horizontal scaling.** Run `pnpm worker` in *two* terminals at once. Submit 20 jobs. Both terminals print `active`/`completed` lines, splitting the work between them. → Same code, two processes, doubled throughput. This is the entire concept of "horizontal scaling" you've been hearing for years.

After #6, sit with it for a moment. *This is what every "we use a job queue" team is doing.* The vocabulary stops being intimidating.

---

## Staff-level concepts to internalize (these are the words you'll use in design reviews)

You don't need to write extra code for these — just understand where each one shows up in what you've built.

- **Idempotency.** Rung 4 retries failed jobs. If your job has side effects (writes to a database, sends an email, charges a card), retries mean those side effects happen ≥1 times. Design the work so running it twice is harmless. Concretely: keyed writes (UPSERT, not INSERT), check-before-act, idempotency keys passed downstream.
- **At-least-once vs at-most-once vs exactly-once.** BullMQ is at-least-once: it guarantees a job is *delivered* to a worker at least once. Network blips between worker and Redis can cause the same job to run twice. "Exactly-once" is mostly a marketing term; what real systems do is "at-least-once + idempotent jobs." Internalize this.
- **Backpressure.** In rung 3 with an unbounded in-memory array, fast producers blow up memory. In rung 4 with Redis, the bound is Redis's memory + you can reject at the producer (`Queue.add` could fail-fast if the queue is too long). Real systems do one of: bounded queue + reject, bounded queue + block producer, unbounded + monitoring + scale workers.
- **Polling cadence.** Your client polls every 1 second. At 1000 concurrent users, that's 1000 RPS on a status endpoint that mostly returns "still working." Exponential polling (1s → 2s → 5s with a cap) is one fix; **Server-Sent Events**, **WebSockets**, or **webhooks back to the client** are the proper fixes. You won't build them here — just know where they slot in.
- **Observability.** When a job goes wrong in production, you need to find it. Three things to internalize: (a) every log line in the worker should include the `jobId` so you can grep across processes; (b) you want a queue UI for humans (BullBoard, Bull Dashboard, your own page); (c) you want metrics — counts by state, throughput, retry rate, p99 duration.
- **The dual nature of a job.** A job is **state** (status, attempts, payload, timestamps) and **behavior** (the function that processes it). BullMQ stores state in Redis; behavior is your code. This split is *why* workers can be deployed independently of the API, scaled independently, written in a different language (BullMQ has a Python port), or replaced.

---

## When you get stuck

For each library, you only need a small surface — search for these exact terms:

- Next.js App Router: "route handler POST formData", "dynamic route params Next 16", "route runtime nodejs"
- sharp: "sharp resize toBuffer"
- BullMQ: "Queue.add options", "Worker concurrency limiter", "job updateProgress", "getJobCounts", "removeOnComplete"
- ioredis: "ioredis maxRetriesPerRequest null bullmq" — this one is the most common gotcha

Do **not** open Redis docs. If you find yourself there, that's the scope-creep instinct firing — close the tab.

---

## Where to go next (after you finish)

Name-only, so you have a map:

- **SSE / WebSockets / webhooks** — replace polling with push.
- **Cross-machine workers** — the same `pnpm worker` script on three boxes pointed at the same Redis. Identical to rung 4 #6, just different IPs.
- **Job replay tooling** — when a DLQ piles up, how do you re-run them after fixing the bug? BullBoard does this. Build your own button for it.
- **Job scheduling / repeating jobs** — `queue.add(name, data, { delay: 60_000 })` for "run in 1 minute"; `queue.upsertJobScheduler(...)` for cron-style repeats.
- **Multi-stage pipelines / fan-out** — one job produces N sub-jobs. BullMQ's "flows" feature.
- **A different substrate** — once you've done this in BullMQ, try the same shape with `pg-boss` (Postgres-backed) or AWS SQS. The producer/consumer mental model is identical; you'll learn the substrate-specific quirks in an hour because the shape transfers.

---

## Suggested pace

Each rung is one focused session. Don't binge — let each rung sit overnight before moving on. The "oh" moments tend to land when you come back fresh.

- Day 1: Rung 0 + Rung 1 (90 min). The pain rung.
- Day 2: Rung 2 (90 min). The receipt rung.
- Day 3: Rung 3 (60 min). The producer/consumer rung.
- Day 4: Rung 4 (2 hours). The Redis rung.
- Day 5: Re-read the staff-level concepts section and check that each one points at a specific moment in *your* code.

If you can explain rungs 1–4 to another engineer using just the words in this guide, you've absorbed it. Try that as the final check.
