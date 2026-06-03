# Checkpoint 05 — `app/scratch-04/api/job/[id]/route.ts` (the status reader)

## Concept

GET handler the page polls. It reads one job *by id* and returns a small JSON
snapshot: state, progress, result, error. You'll also need a tiny types file,
`lib/scratch-04-types.ts`, exporting the `JobResponse` shape.

## Questions

**Q1.** The **worker** is the process doing the resizing. How can this Next.js
route report the job's progress and result when it never runs the processor?
(Where does that information physically live, and what handle does the route use
to read it?)

> Your answer:

**Q2.** `await job.getState()` returns `waiting | active | completed | failed |
delayed`. In terms of checkpoint 01's atomic-move model, what does a "state"
*physically* correspond to in Redis?

> Your answer:

**Q3.** `job.returnvalue`, `job.failedReason`, `job.progress`, `job.attemptsMade`
— when does each become populated, and by whom?

> Your answer:

**Q4.** `queue.getJob(id)` can return `undefined`. Name **two** different reasons
that can happen — and note the subtle UX trap it creates given checkpoint 04's
`removeOnComplete`.

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** All of it lives **in Redis**, written there by the worker as it runs
(progress updates, the return value, the failure reason). The route uses the
**`Queue` admin handle** (`getJob`) — the same dead drop — to *read* that state
back out. Producer and reader and worker never talk directly; Redis is the shared
truth. This is exactly why killing the worker doesn't break the status endpoint:
the data is in Redis, not in either process.

**Q2.** A "state" is **which Redis list/set the job currently sits in**.
`waiting` = in the wait list; `active` = atomically moved to the active list by a
worker; `completed`/`failed` = moved to those sets when the processor returns or
exhausts attempts; `delayed` = parked with a future timestamp (e.g. between
retry backoffs). State is *location*, not a flag.

**Q3.** The **worker** writes them to Redis: `job.progress` each time the
processor calls `job.updateProgress(p)`; `job.returnvalue` when the processor
**returns** (the resolved value is serialized into Redis); `job.failedReason`
when the processor **throws** (the error message is stored); `job.attemptsMade`
increments each time the worker runs the processor. The route just reads the
latest snapshot.

**Q4.** (1) The id never existed (bad/typo'd id). (2) The job **completed and was
already removed** by `removeOnComplete` housekeeping (or failed + removed by
`removeOnFail` age). Subtle trap: a client that polls a *little* too slowly can
get `404` *after* the job succeeded, because the job was trimmed between the last
poll and this one. Design the client to treat "saw `completed` once" as terminal,
and/or keep `removeOnComplete.count` high enough to outlast polling.

</details>

<details>
<summary>Build checklist (write them yourself — no solution here)</summary>

`lib/scratch-04-types.ts` must:
- [ ] export a `JobResponse` type with: `id?`, `state` (BullMQ's `JobState` plus an `'unknown'` fallback), `progress` (number), `result?` (the data URL), `error?` (the failed reason), `attemptsMade?`
- [ ] import the `JobState` type from `bullmq` (note: it's a *type-only* import)

`app/scratch-04/api/job/[id]/route.ts` must:
- [ ] export `async function GET(req, { params })` — in this Next version `params` is a `Promise`, so you must `await` it to get `id`
- [ ] look the job up by id via the `queueScratch04` admin handle
- [ ] return `404` if no job comes back (remember the two reasons that happens)
- [ ] read the job's current state, progress, return value, failed reason, attempts
- [ ] return them as a `JobResponse` JSON

APIs to look up:
- BullMQ: `queue.getJob(id)`, `job.getState()`, and the job fields `progress` / `returnvalue` / `failedReason` / `attemptsMade`
- Next.js route handler signature for a dynamic `[id]` segment in this version (check `node_modules/next/dist/docs/` per AGENTS.md — `params` may be async)

Verify when done:
- polling a live job shows `progress` climbing and `state` moving `waiting`→`active`→`completed`
- a bad/unknown id returns `404`
- after a job is housekept away (`removeOnComplete`), the same id starts returning `404` — confirm your page handles that gracefully (checkpoint 07)

</details>
