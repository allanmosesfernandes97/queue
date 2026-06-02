# Checkpoint 01 — The mental model (before any code)

## Concept

In **rung 3**, the queue was a JavaScript `Array` living inside the Next.js Node
process. A producer (the API route) `push`ed onto it; a consumer (a loop in the
*same* process) `shift`ed off it. Rung 4 changes exactly **one** thing
structurally — and retries, DLQ, scaling all fall out of it for free.

## Questions

**Q1.** If you `Ctrl-C` the Next.js dev server in rung 3, what happens to jobs
sitting in that `Array`, and *why* — what is it about where the array lives?

> Your answer:

**Q2.** Rung 4 moves the queue into Redis, a *separate running program*. When the
API route "adds a job," what physically happens now — what travels where?

> Your answer:

**Q3.** The worker (`pnpm worker`) and Next.js (`pnpm dev`) are two separate OS
processes — no shared memory, no imports, no function calls. Yet a job submitted
in the browser gets resized by the worker. **What is the only thing they share
that makes this possible?** And how does the worker find out a job exists — does
Next.js call it?

> Your answer:

**Follow-ups (confirm understanding):**

**A.** If you start the worker *first* and the queue is empty, what is it doing
during those idle seconds — burning CPU, or something else?

> Your answer:

**B.** Two workers, one queue, ten jobs. Does Redis send every job to *both*
workers (each image resized twice)? If not, what prevents double-grabbing?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** The array lived in the process's **heap (RAM)**, which exists only as
long as the process does. `Ctrl-C` → `SIGINT` → process dies → heap reclaimed →
jobs gone. Deeper point: one process holding *everything* is a single point of
failure — OOM, deploy, crash, any of them vaporizes the queue. **In-memory state
is tied to process lifetime.** That's the disease rung 4 cures.

**Q2.** `queue.add(...)` **serializes** the job to a string and sends a **Redis
command over a TCP socket** to the Redis server. Redis writes it into a data
structure (list/sorted set) **in Redis's own memory**, keyed by the queue name.
Then the route returns `202`. Redis is **passive** — it just holds data and
answers commands; it never calls anyone.

**Q3.** The only shared thing is **Redis itself**, and precisely **one agreed
string: the queue name** (`'scratch-4-resize'`). Both processes are configured
with the same `REDIS_URL` and the same queue name. That's the *entire* coupling
— a dead drop: one side leaves an envelope under a named bench, the other picks
it up; neither knows the other exists. The worker **pulls** — it isn't pushed
to. Next.js never calls the worker. The worker sits on a **blocking** Redis
command (`BRPOPLPUSH`/`BZPOPMIN`): "give me the next job, and don't answer until
one exists." It sleeps at the OS level (≈0% CPU) until Redis wakes it.

**A.** Idle, **blocked at the OS level**, ~0% CPU, woken by Redis the instant a
job lands. Not busy-spinning.

**B.** Not both — **exactly once**, split between them. Mechanism: **Redis is
single-threaded**, so commands run one at a time, indivisibly. Claiming a job is
an **atomic move** from the `wait` list to the `active` list. The first worker's
claim removes the job from `wait` before the second worker's claim even begins;
the second sees a list without that job and grabs the next one. No locks you
write, no handshake — Redis's single-threadedness is the referee. (This same
atomic-move-between-lists is how BullMQ tracks state: `wait → active →
completed`/`failed`. A job's "state" is literally *which Redis list/set it sits
in.*)

</details>
