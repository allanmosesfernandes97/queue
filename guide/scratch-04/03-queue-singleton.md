# Checkpoint 03 — `lib/queue-scratch-04.ts` (producer handle + job type)

## Concept

```ts
import { Queue } from 'bullmq';
export type ResizeJobData = { fileName: string; base64: string };
// singleton-on-globalThis, bound to a queue NAME
```

## Questions

**Q1.** We singleton this on `globalThis` too. A `Queue` instance opens its
**own** internal Redis connection. So what specifically goes wrong on HMR if we
don't guard it?

> Your answer:

**Q2.** Does `new Queue('scratch-4-resize', ...)` in Next.js **start any
processing** / make Next.js a consumer? If not, what *is* this object — what
powers does it grant? Contrast with the `Worker`.

> Your answer:

**Q3.** The type is `{ fileName, base64 }` — the whole image, base64-encoded, in
`job.data`. **Where does `job.data` physically live**, what's the cost of a 5 MB
image there, and why is "store the blob elsewhere, put only a key in the job" the
production move?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** Same leak as checkpoint 02, one level up. A `Queue` opens its own
internal Redis connection on construction. HMR re-runs `new Queue(...)` every
save → a fresh internal connection each time → the `maxclients` leak again. The
`globalThis` guard builds the Queue (and its connection) once and reuses it.

**Q2.** It starts **zero** processing — Next.js never becomes a consumer no
matter how many `Queue` objects it makes. The `Queue` is a **producer + admin
handle**: `add()` jobs, and *inspect/manage* them — `getJob(id)`,
`getJobCounts()`, `pause()`, `drain()`. Processing is the **`Worker`'s** job
(the separate `pnpm worker:scratch-04` process). Tight distinction:
**`Queue` = write/inspect; `Worker` = process.**

**Q3.** `job.data` lives **in Redis**, an in-memory store — every byte is RAM on
the Redis server. base64 is **~33% larger** (4 chars per 3 bytes ≈ 1.33×, *not*
33×). A 5 MB image ≈ 6.6 MB of Redis RAM *per job*; 1,000 queued jobs ≈ 6.6 GB
just holding bytes. Worse, the blob is **re-serialized and shipped over the wire
on every read** (every status poll drags the whole payload back). Prod move: put
bytes in blob storage (S3/GCS), put a tiny **key/URL** in `job.data`; the worker
fetches the blob only when it actually processes. base64 is kept here purely to
make the lesson self-contained.

</details>

<details>
<summary>The file (already committed at lib/queue-scratch-04.ts)</summary>

```ts
import { Queue } from 'bullmq';
import { redisScratch04 } from './redis-scratch-04';

export type ResizeJobData = {
    fileName: string;
    base64: string;
};

type GlobalQueue = { __queueScratch04?: Queue<ResizeJobData> };
const g = globalThis as unknown as GlobalQueue;

export const queueScratch04 =
    g.__queueScratch04 ??
    new Queue<ResizeJobData>('scratch-4-resize', { connection: redisScratch04 });
g.__queueScratch04 = queueScratch04;
```

</details>
