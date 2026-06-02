# Checkpoint 05 — Reliability: idempotency, at-least-once, DLQ, cost

## Concept

This is the checkpoint that separates "I used a queue" from "I understand
distributed systems." The queue gives you **at-least-once** delivery. Everything
here is about making that guarantee *safe* and *observable*.

## Questions

**Q1.** State the difference between **at-least-once**, **at-most-once**, and
**exactly-once** delivery. Which does BullMQ give you, why is true exactly-once
generally impossible, and how do you *simulate* exactly-once *effects*?

> Your answer:

**Q2.** A job goes `active`, the worker is hard-killed (deploy, OOM, `kill -9`)
mid-processing. Walk through what BullMQ does next — the lock, the stall, the
redelivery — and what that forces you to guarantee about your processor.

> Your answer:

**Q3.** Design your **DLQ strategy**. When a transcription job exhausts its
attempts and lands in `failed`: who/what notices, what does the user see, and how
would you *replay* it after fixing the cause? Is "failed forever, silently" ever
acceptable?

> Your answer:

**Q4.** **Poison message:** one upload always crashes the worker (malformed file
triggers a bug). With `attempts: 3` it fails 3× and parks in DLQ — fine. But what
if the bug crashes the *whole worker process* instead of throwing? What's the
risk to *other* jobs, and how does BullMQ's stall detection both help and hurt
here?

> Your answer:

**Q5.** **Cost control.** This pipeline spends real money per job (LLM + transcription
tokens). List every mechanism in your design that prevents a bug or burst from
running up a huge bill.

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** **At-most-once:** every job runs 0 or 1 times — you might *lose* work but
never duplicate it (fire-and-forget, no retry). **At-least-once:** every job runs
1+ times — you never lose work but might *duplicate* it (retry on failure/crash).
**Exactly-once:** runs precisely once — the holy grail. BullMQ gives **at-least-once**.
True exactly-once *delivery* is impossible in a distributed system (the worker
can always crash in the gap between "did the work" and "acked the work" — you
can't make those two atomic across a network). What you *can* do is achieve
exactly-once **effects** by making processing **idempotent**: dedupe on a key,
check-if-already-done, or use upserts, so running twice produces the same end
state as running once.

**Q2.** BullMQ puts a **lock** on a job when a worker takes it `active`, and the
worker **renews the lock** periodically (heartbeat). A hard kill stops the
renewals. After the lock expires, BullMQ's **stalled-job check** notices the
job's worker went silent, marks it **stalled**, and **redelivers** it (back to
`wait`, up to a stalled limit). So an interrupted job is *not lost* — but it
**runs again**. That forces your processor to be **idempotent** (Q4 of checkpoint
04): writing results must be safe to repeat, and expensive external calls should
be guarded by an already-done check.

**Q3.** A real DLQ strategy, not "ignore the failed set":
- **Notice:** a small monitor (or dashboard alert) watches the `failed` count;
  rising failures → alert (log, email, Slack webhook). The dashboard lists DLQ
  contents with `failedReason`.
- **User sees:** the upload's Postgres status flips to `failed` with a friendly
  message ("we couldn't process this file") — never a spinner forever.
- **Replay:** keep `removeOnFail` long enough to inspect; provide a "retry" action
  that re-enqueues the failed job (BullMQ jobs have `.retry()`), used *after* you
  fix the cause. **"Failed silently forever" is never acceptable** — a job that
  dies invisibly is worse than one that errors loudly. Visibility is the point of
  a DLQ.

**Q4.** If the job **throws**, only that job is affected — retries, then DLQ,
others unharmed. If the bug **crashes the whole process**, every job that was
`active` in that worker dies with it. Stall detection **helps** (those jobs get
redelivered, not lost) but **hurts** (they get redelivered to *another* worker,
which the same poison file crashes too → a crash that cascades across your fleet
and can take down processing for *everyone*). Defences: wrap processors so input
errors **throw** instead of crashing the process; validate input early; cap
concurrency so one crash kills fewer in-flight jobs; and consider a per-job
"crash count" that quarantines a job after N process-deaths. This — a single bad
message repeatedly killing healthy workers — is the classic **poison-message**
failure, and naming it is a strong interview signal.

**Q5.** Cost defences in the design:
- **Rate `limiter`** caps calls per minute → bounds spend per minute.
- **Idempotency / already-done checks** → never pay twice for a redelivered job.
- **`attempts` cap + non-retryable error detection** → a doomed job doesn't burn
  5 paid attempts.
- **DLQ** → poison jobs stop, instead of retrying (and billing) forever.
- **Concurrency caps** → bounded parallel spend.
- (Prod-grade) a **monthly budget guard** / spend counter in Redis that pauses
  queues when exceeded. Mentioning this shows you think about the business, not
  just the code.

</details>
