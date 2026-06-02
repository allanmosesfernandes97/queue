# Checkpoint 04 — The pipeline jobs in detail

## Concept

Each job type has a *profile*: what it calls, how slow it is, how it fails, and
therefore what `attempts`/`backoff`/`limiter`/`concurrency` it needs. Tuning
these per job is where your scratch-04 knowledge becomes engineering judgement.

## Questions

For each job, you'll reason about its retry/rate-limit profile. First, the
warm-up:

**Q1.** `transcribe` calls an external transcription API (Whisper/Deepgram). It's
slow (30s–several min), and the API returns `429 Too Many Requests` under load
and occasional `500`s. What `attempts`, `backoff`, and `limiter` would you set,
and why? Should a `429` and a "file is corrupt" error be retried the same way?

> Your answer:

**Q2.** `summarise` and `generate-posts` both call an LLM with a **tokens-per-minute**
limit shared across them. How do you keep *both* queues under one shared budget?
(scratch-04's `limiter` is per-queue — what's the wrinkle here?)

> Your answer:

**Q3.** `thumbnail` is CPU-bound (decode audio waveform / render an image, no
network). What's different about its failure profile and its concurrency vs. the
API jobs? Would you even give it `attempts: 3`?

> Your answer:

**Q4.** A job calls an LLM, the call succeeds and costs you $0.04, then the worker
crashes *before* writing the result to Postgres. The job is redelivered (at-least-once)
and runs the LLM call **again** — another $0.04. How do you stop paying twice?
(This is the bridge to checkpoint 05.)

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** Transcription profile: `attempts: 4–5`, `backoff: { type: 'exponential',
delay: 2000 }` (longer base delay — the API needs breathing room after a 429),
`limiter` set to **just under the provider's documented rate cap**,
`concurrency` moderate (it's I/O-bound — mostly waiting). **Crucial distinction:**
a `429`/`500` is **transient** → retry. A "file is corrupt / unsupported format"
is a **permanent** error → retrying wastes 5 attempts and delays the DLQ. Senior
move: detect non-retryable errors and **fail fast** (in BullMQ, throw an
`UnrecoverableError` so it skips remaining attempts and goes straight to
`failed`). Don't retry what can't succeed.

**Q2.** The wrinkle: BullMQ's `limiter` is **per-queue**, but your *cost/limit* is
**per-provider**, shared across `summarise` + `generate-posts`. Options:
(a) Put both LLM steps on **one queue** with one limiter (simplest correct
answer — accept they share concurrency). (b) Keep separate queues but enforce a
**shared rate limiter in code** (e.g. a Redis-backed token-bucket both workers
check before calling the API). (c) Use BullMQ's **group rate limiting**. For v1,
(a) is the pragmatic, explainable choice. The insight to *state*: rate limits
belong to the *resource* (the API), so your limiter scope must match the resource,
not the job type.

**Q3.** `thumbnail` failures are mostly **deterministic** — if the code throws on
this file, it'll throw again on retry (bad input, bug). So `attempts: 3` buys you
little; maybe `attempts: 2` for transient blips (OOM under load), then DLQ.
Concurrency: **low** — it's CPU-bound on a single-threaded event loop, so running
many in one process just thrashes; scale thumbnails by **adding worker
processes**, not by raising concurrency. (Exactly the scratch-04 concurrency-vs-horizontal
distinction.)

**Q4.** **Idempotency.** Make the job safe to run twice:
- Before calling the LLM, **check Postgres**: does a result for this `upload_id`
  already exist? If yes, skip the call and return it.
- Or use a deterministic **idempotency key** (the upload id + step name) so a
  re-run is a no-op / reuses the prior result.
- Where the provider supports it, pass an **idempotency key** to the API itself.

This is the practical face of **at-least-once delivery**: the queue guarantees a
job runs *at least* once (redelivery on crash), so *you* must make running it
twice harmless. Money makes this non-negotiable here — fully covered in
checkpoint 05.

</details>
