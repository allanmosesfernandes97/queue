# Rung 3 — Producer/Consumer with explicit worker

## The concept

In rung 2, your "worker" was just an `async` function called inside the POST handler. There was no real *queue* — every submitted job started immediately. That's why CPU pinned.

In rung 3 you separate three things that were tangled together:
- **Producer** — the code that creates work (your POST handler). It only adds to a queue.
- **Queue** — a data structure that holds pending work (an in-memory array).
- **Consumer / worker** — code that pulls items off the queue and processes them, with a **concurrency limit**.

This split is the mental skeleton of every queueing system you'll ever see — Sidekiq, Celery, BullMQ, SQS+Lambda, RabbitMQ, Kafka consumers. The substrate changes; the shape doesn't.

## What you build

- **`lib/queue-rung-3.ts`** — exports:
  - An array of pending jobs (just `Array<{ id, input }>`).
  - A `Map<id, JobState>` for status (same shape as rung 2).
  - An `enqueue(id, input)` function the producer calls.
  - A `getJob(id)` for the status endpoint.
  - A `stats()` function returning `{ pending, active, concurrency }`.
  - A **worker loop** that processes jobs with a concurrency cap.
- POST and GET routes — same shape as rung 2, but the POST only calls `enqueue` and returns. The work logic is no longer in the route handler.
- Page — same as rung 2 but with a "submit N copies" input, and a live readout of `{ pending, active, concurrency }`. Watching that readout is the lesson.

## Hand-roll the concurrency limit (don't reach for a library yet)

You want to limit *active* jobs to N at any time. Pseudocode of the shape:

> Keep an `active` counter. A `tick()` function: while `active < CONCURRENCY` and there's a pending job, take one off the front, increment `active`, kick off processing, and when it finishes, decrement `active` and call `tick()` again. Call `tick()` whenever someone enqueues.

This is ~15 lines. You'll write it yourself. You'll understand semaphores after.

Why hand-roll instead of `p-limit`? Because the lesson is *what concurrency control is*, not *how to import it*. Once you've written it once, you'll recognize it everywhere — Go's `semaphore.Weighted`, Python's `asyncio.Semaphore`, Java's `Executor`, BullMQ's `concurrency` option.

## HMR gotcha (worth knowing about, not worth fearing)

Next.js dev mode reloads modules on file change. If you store the queue in a module-level variable, every reload resets it. Fix by stashing on `globalThis` (the standard Prisma-in-Next pattern). One-time learning, do it once, move on.

## Make concurrency configurable

Read `RUNG3_CONCURRENCY` from `process.env`, default 2. The point is that concurrency is now a **knob** instead of a side effect of however many parallel requests happen to come in.

## Verify the lesson lands

- [ ] Submit 10 copies of a job. The page should show `active: 2, pending: 8` (or whatever your concurrency is), and the pending count tick down as workers free up.
- [ ] Restart with `RUNG3_CONCURRENCY=5 pnpm dev`. Throughput visibly goes up.
- [ ] Kill the dev server mid-batch. *All* pending work is gone. Active work that hadn't written to the result store is also gone. This is the pain rung 4 fixes.

## The lesson

Producer/consumer separation is the heart of every queueing system. Once you've split them, **concurrency becomes a configuration**, not a side effect. The next limitation isn't conceptual — it's that one process is a hard ceiling and a crash wipes the queue.
