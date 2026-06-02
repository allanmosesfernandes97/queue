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
<summary>The files (build them yourself first)</summary>

`lib/scratch-04-types.ts`:

```ts
import type { JobState } from 'bullmq';

export type JobResponse = {
    id?: string;
    state: JobState | 'unknown';
    progress: number;
    result?: string;       // data URL, set after success
    error?: string;        // failedReason, set after final failure
    attemptsMade?: number; // how many times the worker has run it
};
```

`app/scratch-04/api/job/[id]/route.ts`:

```ts
import { queueScratch04 } from '@/lib/queue-scratch-04';
import { JobResponse } from '@/lib/scratch-04-types';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = await queueScratch04.getJob(id);
    if (!job) {
        // Either never existed, or completed/failed and already housekept away.
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const state = await job.getState(); // = which Redis list/set the job is in
    const body: JobResponse = {
        id: job.id,
        state,
        progress: typeof job.progress === 'number' ? job.progress : 0,
        result: job.returnvalue,       // written by the worker on return
        error: job.failedReason,       // written by the worker on final throw
        attemptsMade: job.attemptsMade,
    };
    return Response.json(body);
}
```

</details>
