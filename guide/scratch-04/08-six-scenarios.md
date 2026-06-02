# Checkpoint 08 — Prove the six scenarios

These are the actual lessons. Run **two terminals**: `pnpm dev` and
`pnpm worker:scratch-04`. Open `http://localhost:3009/scratch-04`. For each
scenario: **predict first**, then run it, then check your prediction against the
"what proves it" note. When all six hold no surprises, you've internalised the
model.

> First, add the script to `package.json`:
> `"worker:scratch-04": "tsx --env-file=.env.local workers/scratch-4-worker.ts"`
> and the `.env.local` keys from the README.

---

## 1. Survives API crash

Submit ~10 jobs. `Ctrl-C` the **dev server**. Restart it.

**Predict:** what happens to the in-flight and waiting jobs?

> Your prediction:

<details><summary>What proves it</summary>
Jobs keep processing in the worker terminal the whole time — the dev server being
down is irrelevant. **The queue isn't in Next.js anymore; it's in Redis.** The
producer is just one of many clients; killing it doesn't touch the data.
</details>

## 2. Survives worker crash

Submit ~10 jobs. `Ctrl-C` the **worker**. Watch the counts. Restart the worker.

**Predict:** where do the jobs go while the worker is down? After restart?

> Your prediction:

<details><summary>What proves it</summary>
Jobs sit in `waiting` (and any that were `active` at kill time become `stalled`
then return to `waiting`). Counts hold steady — nothing is lost. Restart the
worker and it resumes pulling. **The queue isn't in the worker either; it's in
Redis.** (Graceful `Ctrl-C` lets the active job finish first via `worker.close()`.)
</details>

## 3. Retry with exponential backoff

Stop the worker. Restart with failure injection:
`$env:FAIL_RATE=0.7; pnpm worker:scratch-04` (PowerShell) — or set it in
`.env.local`. Submit jobs.

**Predict:** what do `attemptsMade` and the delays between tries do?

> Your prediction:

<details><summary>What proves it</summary>
Watch attempts climb 1 → 2 → 3 with a **growing gap** between (≈1s, then ≈2s) —
the job sits in `delayed` during each backoff. Then it either finally succeeds or
exhausts attempts and fails. The retry is performed by the **worker**, governed
by the `attempts` + `backoff` opts you set on `add()`.
</details>

## 4. Dead-letter queue (DLQ)

Same as #3 but `FAIL_RATE=1` (always fails). Submit jobs.

**Predict:** after 3 attempts, where does each job end up, and does it keep
retrying forever?

> Your prediction:

<details><summary>What proves it</summary>
After 3 attempts each job moves to the **`failed` set** and **stops** — the
`failed` count climbs and stays. That parked-after-exhaustion set **is** the DLQ:
the job waits for human judgement (inspect `failedReason`, fix the cause, replay).
Not a separate queue — just the `failed` state. `removeOnFail` controls how long
it lingers.
</details>

## 5. Rate limit

Stop the worker. Restart with `$env:SCRATCH04_RATE_PER_SEC=2;
pnpm worker:scratch-04`. Submit ~30 jobs at once.

**Predict:** at what rate do jobs start, regardless of how many are queued?

> Your prediction:

<details><summary>What proves it</summary>
Jobs start at **2/second**, dripping out steadily while the rest wait in
`delayed`/`waiting` — no matter how big the burst. This is how you shield a
fragile downstream (third-party API, DB) from a flood. The limiter caps *starts
per window*, not total queued.
</details>

## 6. Horizontal scaling

Run `pnpm worker:scratch-04` in **two** terminals at once (turn FAIL_RATE back to
0, rate limit back up). Submit ~20 jobs.

**Predict:** does each job run once or twice? How is the work divided, and who
coordinates it?

> Your prediction:

<details><summary>What proves it</summary>
Both terminals print `active`/`completed` lines, **splitting** the 20 jobs — each
job runs **exactly once**. No coordination code: Redis's single-threaded
**atomic claim** (`wait → active`) guarantees only one worker gets each job.
Same code, two processes, ~2× throughput. **This is the entire concept of
"horizontal scaling."** Sit with it — this is what every "we use a job queue"
team is doing.
</details>

---

## After #6 — the closing reflection

Write a few sentences (for yourself) answering: *Which single structural change
from rung 3 made all six of these possible, and how does each scenario trace
back to it?* If you can do that cleanly, the rung is internalised.

> Your reflection:

<details><summary>The thread that ties them together</summary>
Every scenario is a consequence of **moving the queue out of the Node process and
into Redis, a separate program both sides address by name.** Crash-survival (1,2)
= the data outlives any single process. Retry/DLQ (3,4) = a durable store can
hold a job's attempt history and re-schedule it. Rate-limit (5) = a central
broker can meter starts. Scaling (6) = many processes can atomically share one
durable queue. One change; everything else is downstream of it.
</details>
