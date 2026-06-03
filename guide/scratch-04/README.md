# scratch-04 — Build rung 4 (Redis + BullMQ) from scratch, Socratically

This folder is a **self-contained workbook**. The goal is not to copy rung-04 —
it's to *reconstruct* it from first principles, reasoning out every decision
before any code is written. The existing `app/rung-04/*` stays untouched as a
reference to compare against.

## How to use this (as the learner)

Work the checkpoints **in order** (`01` → `08`). Each file has:

1. **Concept** — the minimum mental model for that piece.
2. **Questions** — answer these *in your own words* in the `> Your answer:`
   blocks. Don't peek first.
3. **Model answer** — a collapsed `<details>` block. Open it only after you've
   written yours, then self-grade: where were you fuzzy? That fuzz is the lesson.
4. **Build checklist** — *not* a ready-made file. What the file must do, which
   APIs to look up, and how to verify it. **You write the code yourself.**
   (Checkpoints 02–03 show the committed files only because we built those
   together already; everything from 04 on is yours to write.)

Progress so far (done together on the original machine):

- [x] **01 — Mental model** (rung 3 → rung 4 leap)
- [x] **02 — `lib/redis-scratch-04.ts`** (connection)  ← file already in repo
- [x] **03 — `lib/queue-scratch-04.ts`** (producer handle + type)  ← file already in repo
- [ ] **04 — Producer POST route**  ← you stopped here, questions posed, not yet answered
- [ ] **05 — Status GET route**
- [ ] **06 — Worker (the consumer)**
- [ ] **07 — Page UI + job counts**
- [ ] **08 — Prove the six scenarios**

## How to use this (as the next LLM — the Socratic contract)

If a human pastes a checkpoint file and asks you to continue, follow these rules
**exactly** — they are the whole point:

1. **Never write code for a checkpoint until the learner has reasoned out what
   it should do.** Ask the questions, wait for answers, *then* grade.
2. **Grade honestly.** Praise what's right in one line; spend your words on the
   gaps and misconceptions. Correct wrong numbers, wrong terminology, wrong
   causality — gently but precisely. The corrections are where learning happens.
3. **Teach from first principles, not vocabulary.** Always answer "why", trace
   "what physically happens / what travels where", and connect each feature back
   to the one structural change (the queue lives in Redis, a separate program).
4. **One checkpoint at a time.** Confirm understanding with 1–2 follow-up
   questions before moving on. Use a task list to track the eight checkpoints.
5. **Only after the learner reasons it out**, write the file with **heavy inline
   comments explaining the *why*** of each decision (see the committed
   `lib/redis-scratch-04.ts` and `lib/queue-scratch-04.ts` for the comment style).

## Naming + isolation conventions (decided already — keep them)

| Thing | Name | Why |
|---|---|---|
| Redis connection | `lib/redis-scratch-04.ts` → `redisScratch04` | isolated from rung-04 |
| Queue handle | `lib/queue-scratch-04.ts` → `queueScratch04` | producer + admin handle |
| **Queue name (the "dead drop")** | `'scratch-4-resize'` | **must differ** from rung-04's `'rung-4-resize'` or the two apps' workers steal each other's jobs |
| Job data type | `ResizeJobData = { fileName, base64 }` | base64 is a *lesson shortcut*; prod stores a blob key |
| Producer route | `app/scratch-04/api/route.ts` | POST, returns 202 + jobId |
| Status route | `app/scratch-04/api/job/[id]/route.ts` | GET one job's state |
| Counts route | `app/scratch-04/api/stats/route.ts` | GET `getJobCounts(...)` |
| Page | `app/scratch-04/page.tsx` | submit, poll, progress, counts |
| Worker | `workers/scratch-4-worker.ts` | standalone `tsx` process |
| Types | `lib/scratch-04-types.ts` | `JobResponse` shape |

`package.json` script to add:

```json
"worker:scratch-04": "tsx --env-file=.env.local workers/scratch-4-worker.ts"
```

`.env.local` keys this rung reads:

```
REDIS_URL=redis://localhost:6379
SCRATCH04_CONCURRENCY=3
SCRATCH04_RATE_PER_SEC=5
FAIL_RATE=0          # 0..1 — chance the worker throws, to exercise retries/DLQ
```

## The one idea everything hangs on

> Rung 3's queue was a JavaScript `Array` inside the Next.js process. Rung 4
> swaps that array for **a queue that lives in a separate program (Redis) that
> any process can talk to.** Producer (Next.js) and consumer (worker) are now
> separate OS processes that share *nothing* but a Redis address and a queue
> name. Retries, DLQ, rate-limiting, and horizontal scaling all fall out of that
> single structural change.
