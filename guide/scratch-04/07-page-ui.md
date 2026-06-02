# Checkpoint 07 — `app/scratch-04/page.tsx` (+ counts route)

## Concept

A client component: submit the form (→ `202` + `jobId`), then **poll** the status
endpoint until the job is terminal, showing a progress bar and finally the
result image. Plus a live **job-counts** panel
(`waiting/active/completed/failed/delayed`) backed by a small stats route.

## Questions

**Q1.** The page **polls** every ~1s instead of the server **pushing** updates.
Why is polling the natural fit here, and what would you reach for if you wanted
push instead (and why isn't it worth it for this rung)?

> Your answer:

**Q2.** When should the polling loop **stop**? Name every terminal condition.
What goes wrong if you forget to stop (besides wasted requests — think about the
`404`-after-`removeOnComplete` trap from checkpoint 05)?

> Your answer:

**Q3.** The counts come from `queue.getJobCounts('waiting','active','completed',
'failed','delayed')`. Operationally, what does each number tell you, and which
*pair* moving tells you "the system is healthy and draining"? Which number going
up is your alarm bell?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** The work is **fire-and-forget with a receipt**: the producer already
returned `202` and the browser holds a `jobId`, so "ask Redis how that id is
doing every second" is dead simple and stateless — plain HTTP GETs, no extra
infra. Push would mean **WebSockets or Server-Sent Events** (the server streams
progress as it changes). That's strictly better for latency/efficiency at scale,
but it adds a persistent connection, a subscription to BullMQ's events, and more
moving parts — overkill for a learning rung where 1s latency is fine. (Worth
knowing: BullMQ has `QueueEvents` you could bridge to SSE later.)

**Q2.** Stop when the job reaches a **terminal** state: `completed` **or**
`failed` (and on a hard `error`/`404` from the endpoint). If you don't stop:
besides hammering the server, you hit the **`removeOnComplete` trap** — once the
completed job is housekept away, your still-running poller starts getting `404`,
and naive code might interpret that as "job vanished/failed" and flip the UI from
success back to an error. Treat "saw `completed` once" as final and tear the
interval down.

**Q3.** `waiting` = backlog not yet picked up. `active` = currently being
processed (≈ bounded by total concurrency across workers). `completed` =
finished OK. `failed` = exhausted all attempts → **the DLQ**. `delayed` = parked
for a future time (retry backoff or rate-limiter holding). Healthy draining =
**`waiting` falling while `completed` rises** (and `active` > 0). Alarm bell =
**`failed` climbing** (work is dying) or **`waiting` growing unbounded** (workers
can't keep up — add processes / concurrency).

</details>

<details>
<summary>The files (build them yourself first)</summary>

`app/scratch-04/api/stats/route.ts`:

```ts
import { queueScratch04 } from '@/lib/queue-scratch-04';

export async function GET() {
    const counts = await queueScratch04.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
    );
    return Response.json(counts);
}
```

`app/scratch-04/page.tsx`:

```tsx
'use client';

import { JobResponse } from '@/lib/scratch-04-types';
import { useEffect, useState } from 'react';

type Counts = Record<string, number>;

export default function Scratch04() {
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<JobResponse | null>(null);
    const [counts, setCounts] = useState<Counts>({});

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const res = await fetch('/scratch-04/api', { method: 'POST', body: new FormData(e.currentTarget) });
        if (!res.ok) return;
        const { jobId } = await res.json();
        setJob(null);
        setJobId(jobId);
    };

    // Poll one job until it reaches a terminal state.
    useEffect(() => {
        if (!jobId) return;
        if (job?.state === 'completed' || job?.state === 'failed' || job?.error) return;
        const tick = async () => {
            const res = await fetch(`/scratch-04/api/job/${jobId}`);
            if (!res.ok) return; // 404 after housekeeping — keep last good state
            setJob(await res.json());
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [jobId, job?.state]);

    // Poll live queue counts independent of any single job.
    useEffect(() => {
        const tick = async () => {
            const res = await fetch('/scratch-04/api/stats');
            if (res.ok) setCounts(await res.json());
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <section>
            <h2>Scratch 04 — Redis + BullMQ</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Enter file name" name="fileName" />
                <input type="file" accept="image/*" name="image" />
                <button type="submit">SUBMIT</button>
            </form>

            <pre>
                waiting:{counts.waiting ?? 0}  active:{counts.active ?? 0}  completed:
                {counts.completed ?? 0}  failed:{counts.failed ?? 0}  delayed:{counts.delayed ?? 0}
            </pre>

            {jobId && job?.state !== 'completed' && job?.state !== 'failed' && (
                <progress max="100" value={job?.progress ?? 0}>
                    {job?.progress ?? 0}%
                </progress>
            )}
            {job?.state === 'failed' && <p>Failed: {job.error}</p>}
            {job?.state === 'completed' && job.result && <img src={job.result} alt="Resized" />}
        </section>
    );
}
```

</details>
