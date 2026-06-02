# Checkpoint 06 — `workers/scratch-4-worker.ts` (the consumer)

## Concept

A **standalone** TS file run with `tsx` as its own OS process (`pnpm
worker:scratch-04`). It constructs a `Worker(name, processor, opts)`, decodes the
image, reports progress, returns the result, and handles shutdown. This is the
process that does all the actual work.

## Questions

**Q1.** `new Worker(name, processor, { connection })` — the `name` must match the
`Queue`'s name **exactly** (`'scratch-4-resize'`). In dead-drop terms, what
breaks if it doesn't, and would you get an error or just silence?

> Your answer:

**Q2.** `concurrency: 3` inside **one** worker process vs running **three**
worker processes — what's the difference? Given Node is single-threaded, how can
one process work 3 jobs "at once," and when does that actually help?

> Your answer:

**Q3.** `limiter: { max, duration }` (e.g. `{ max: 2, duration: 1000 }`). What
does it cap, across what scope, and what real problem does rate-limiting solve?

> Your answer:

**Q4.** The processor calls `await job.updateProgress(p)`. Trace the full path by
which a number set *here, in the worker process* ends up rendered in the
**browser**. How many hops, through what?

> Your answer:

**Q5.** Why handle `SIGINT`/`SIGTERM` with `worker.close()` instead of just
letting the process die? What happens to a job that's **active** when you
*hard*-kill the worker — is it lost, and what does that imply about writing
processors (hint: at-least-once)?

> Your answer:

**Q6.** We add a `FAIL_RATE` env knob that makes the processor randomly `throw`.
What machinery does throwing trigger, and which checkpoint-04 options govern what
happens next?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** The name *is* the dead drop. A mismatched name means the worker is
listening at a **different bench** than the producer writes to — jobs pile up in
`scratch-4-resize` while the worker waits forever on `scratch-4-reszie`. **No
error, just silence**: jobs sit in `waiting` and nothing processes them. (This is
a classic "why isn't my queue draining" bug — always check the name match.)

**Q2.** **`concurrency: 3` (one process):** the worker pulls up to 3 jobs and
runs their processors **concurrently on one event loop**. This only helps when
the work is **I/O-bound / await-heavy** (network, disk, `await sleep`) — while
one job awaits, the event loop runs another. For **CPU-bound** work (synchronous
`sharp` resize), they don't truly run in parallel — one CPU. **Three processes
(horizontal scaling):** three real OS processes, three event loops, genuinely
parallel across cores, and resilient (one crashing doesn't take the others). Rule
of thumb: concurrency for I/O-bound waiting; more processes for CPU-bound
throughput.

**Q3.** It caps **how many jobs start per time window across that worker**
(`max` jobs per `duration` ms). Purpose: protect a **fragile downstream** — a
rate-limited third-party API, a database, an email provider — from a burst.
Excess jobs wait (`delayed`) and drip out at the allowed rate regardless of how
many are queued.

**Q4.** Hops: (1) worker calls `job.updateProgress(p)` → **writes the number into
Redis** on the job's record. (2) The browser is **polling** every ~1s →
`GET /scratch-04/api/job/:id`. (3) That route uses the `Queue` handle to
**read `job.progress` from Redis** and returns it as JSON. (4) The page sets
state and the `<progress>` bar re-renders. The worker and browser never talk;
Redis is the relay, polling is the pickup.

**Q5.** `worker.close()` is **graceful**: it stops accepting new jobs and lets
in-flight jobs **finish** before exiting. A *hard* kill (e.g. `kill -9`) abandons
the active job — but it isn't lost: BullMQ holds a **lock** on active jobs; when
the lock expires (the worker stopped renewing it), the job is considered
**stalled** and **re-delivered** to another worker. That means a job can run
**more than once** → **at-least-once** delivery. Implication: write processors to
be **idempotent** (safe to run twice) — don't assume exactly-once.

**Q6.** Throwing from the processor triggers BullMQ's **retry machinery**: the
worker records the `failedReason`, increments `attemptsMade`, and — if attempts
remain — moves the job to `delayed` for the **backoff** wait, then re-runs it.
The checkpoint-04 options govern the rest: `attempts` (how many tries) and
`backoff` (the growing delay). When attempts are exhausted, the job lands in the
**`failed` set (the DLQ)** and stops; `removeOnFail` decides how long it lingers
for inspection.

</details>

<details>
<summary>The file (build it yourself first)</summary>

```ts
import { Worker, type Job } from 'bullmq';
import { redisScratch04 } from '@/lib/redis-scratch-04';
import type { ResizeJobData } from '@/lib/queue-scratch-04';
import sharp from 'sharp';
import { sleep } from '@/utils/lib';

const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0); // 0..1

// Worker = the CONSUMER. Name MUST match the Queue's name exactly (the dead drop).
const worker = new Worker<ResizeJobData>('scratch-4-resize', imageProcessing, {
    connection: redisScratch04,
    concurrency: Number(process.env.SCRATCH04_CONCURRENCY ?? 3),
    limiter: {
        max: Number(process.env.SCRATCH04_RATE_PER_SEC ?? 5), // cap starts per window
        duration: 1000,                                       // window = 1 second
    },
});

async function imageProcessing(job: Job<ResizeJobData>) {
    if (!job.data.base64 || !job.data.fileName) throw new Error('Missing job data');

    // Fake work + progress so you can watch it stream to the browser.
    for (let p = 10; p <= 90; p += 10) {
        await sleep(900);
        await job.updateProgress(p); // → writes p into Redis; page reads it via polling
    }

    // Injected failure to exercise retries / backoff / DLQ.
    if (FAIL_RATE > 0 && hashToUnit(job.id ?? '') < FAIL_RATE) {
        throw new Error(`Injected failure (FAIL_RATE=${FAIL_RATE})`);
    }

    const resized = await sharp(Buffer.from(job.data.base64, 'base64'))
        .resize(1024, 1024, { fit: 'contain' })
        .png()
        .toBuffer();

    // Returned value is serialized into job.returnvalue in Redis.
    return `data:image/png;base64,${resized.toString('base64')}`;
}

// Deterministic 0..1 from the job id (avoids Math.random; same job fails same way per attempt set).
function hashToUnit(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
}

// Observability: watch the work happen in the worker terminal.
worker.on('ready', () => console.log('worker ready'));
worker.on('active', (job) => console.log('▶ active', job.id, 'attempt', job.attemptsMade + 1));
worker.on('completed', (job) => console.log('✓ done', job.id));
worker.on('failed', (job, err) => console.log('✗ failed', job?.id, 'attempt', job?.attemptsMade, err?.message));

// Graceful shutdown: let in-flight jobs finish instead of abandoning them.
process.on('SIGINT', () => worker.close());
process.on('SIGTERM', () => worker.close());
```

> Note: the reference rung-04 used `Math.random()` for failure injection. Either
> is fine for the lesson; the id-hash version above is deterministic so a given
> job fails predictably, which makes the retry/DLQ scenarios easier to reason
> about. Use whichever you understand better — just be able to explain it.

</details>
