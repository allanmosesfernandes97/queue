# Checkpoint 08 — Build plan, milestones & CV framing

## Concept

You now have the full design. This checkpoint turns it into an *ordered, shippable*
plan — and frames the result so it actually lands you interviews. Build in thin
vertical slices: each phase ends with something that *works end-to-end*, never a
half-built layer.

## The phased plan (build in this order)

Each phase is demoable on its own. **Don't start a phase until the previous one
runs end-to-end.**

### Phase 0 — Skeleton (reuse scratch-04)
Port the scratch-04 pattern: one queue, one trivial job, producer route, worker,
polling page, counts. Prove the loop works locally. *You've basically done this.*

### Phase 1 — One real job, end to end
`upload audio → blob → enqueue transcribe → worker calls transcription API →
transcript saved to Postgres → UI shows it.` No fan-out yet. This is the hardest
plumbing (blob, DB, real API, presigned upload) — do it once, for one job.
**Milestone:** a real transcript appears in the UI from a real upload.

### Phase 2 — Fan-out + dependency
Add `thumbnail` (parallel) and `summarise` (depends on transcript). Start with
**job chaining**, then refactor to **BullMQ Flows**. **Milestone:** one upload
spawns multiple jobs; summary waits for the transcript.

### Phase 3 — The rest of the pipeline + reliability
Add `generate-posts`. Implement idempotency (already-done checks), per-job
`attempts`/`backoff`/`limiter`, non-retryable error handling, DLQ + a user-facing
`failed` state. **Milestone:** kill the worker mid-job and watch nothing get lost
or double-charged.

### Phase 4 — The observability dashboard
Build the ops dashboard (counts per queue, throughput, retries, DLQ, active
workers) — polling first, then `QueueEvents`/SSE for live progress. Add a couple
of product metrics. **Milestone:** the 2-minute "watch this" resilience demo from
checkpoint 06 works.

### Phase 5 — Deploy & scale
Vercel (app) + Railway/Render (workers) + managed Redis + Neon (Postgres) + R2.
Graceful shutdown, env/secrets split, scale workers to 2+ and show throughput
rise. **Milestone:** a public URL anyone can try, and a worker count you can turn
up live.

## Questions

**Q1.** Why build vertical slices (Phase 1 = *one job all the way through*)
instead of horizontal layers (build all the DB, then all the queues, then all the
UI)? What goes wrong with the horizontal approach for a solo portfolio project?

> Your answer:

**Q2.** Write the **README story** for the repo. What sections make a hiring
engineer take it seriously in 60 seconds? (Think: what would *you* want to see?)

> Your answer:

**Q3.** Draft three CV/portfolio bullet points for this project. They must be
*specific and quantified*, and they must surface the distributed-systems
vocabulary without sounding like buzzword soup.

> Your answer:

**Q4.** In an interview, someone asks *"why did you use a queue instead of just
processing the upload in the request?"* Give your 30-second answer.

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** Vertical slices always leave you with **something that works and demos**;
if you run out of time, you ship Phase 2 and it's still a real project. Horizontal
layering leaves you with **three half-built layers that don't connect** — no demo,
no live link, and integration problems all surface at the end at once (the worst
time). Vertical also surfaces the *hard* integration risks (blob, real API, DB)
in Phase 1 when you can still change the design. Slicing vertically is itself a
signal of how you'd ship in a startup.

**Q2.** README sections that earn 60-second credibility:
- **One-line what + a live demo link + a 20s GIF** of the dashboard working.
- **Architecture diagram** (the boxes from checkpoint 01).
- **"Why a queue"** — 2 sentences on the slow/flaky/expensive AI calls.
- **Reliability section** — at-least-once, idempotency, retries/backoff, DLQ,
  graceful shutdown. *This is what makes you stand out.*
- **Scaling** — "run N workers, throughput scales linearly; here's the graph."
- **Tech + topology** — what runs where and why serverless can't host the worker.
- **Trade-offs / what I'd do next** — shows judgement and self-awareness.

**Q3.** Example bullets (adapt with your real numbers):
- "Built a horizontally-scalable AI media pipeline (Next.js + BullMQ + Redis)
  processing N audio min/hr across M worker processes, with at-least-once
  delivery and idempotent processors to prevent double-billing of LLM calls."
- "Engineered reliability: exponential-backoff retries, non-retryable-error fast-fail,
  a dead-letter queue with replay, and graceful `SIGTERM` shutdown — zero job loss
  across deploys and induced worker crashes."
- "Shipped a real-time ops dashboard (BullMQ `QueueEvents` over SSE) surfacing
  queue depth, throughput, retry rate, and DLQ, deployed across Vercel + Railway
  + managed Redis + Postgres + R2."

**Q4.** *"Transcription and LLM calls take 30 seconds to several minutes, they're
rate-limited, and they fail intermittently — so doing that work inside the HTTP
request would block the user, time out on serverless, and lose work on any error.
I push the work to a queue: the request returns instantly with a job id, workers
process it in the background with retries and backoff, and the user polls for
progress. That also lets me scale the slow work independently by adding workers,
and isolate failures so one flaky provider doesn't take down the whole app."*
(30 seconds, hits async/timeouts/retries/scaling/isolation — every concept.)

</details>

---

## You're ready

You have: a scoped product, an architecture you can whiteboard, a queue topology,
a data model, per-job tuning, a reliability model, an observability plan, a
deployment topology, and a phased build plan with CV framing. Build it in
vertical slices, ship Phase 1 fast, and put the live link on your CV.

Go get the London job. 🇬🇧
