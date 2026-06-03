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
<summary>Build checklist (write them yourself — no solution here)</summary>

`app/scratch-04/api/stats/route.ts` must:
- [ ] export `async function GET()`
- [ ] call `getJobCounts(...)` on `queueScratch04` for `waiting`, `active`, `completed`, `failed`, `delayed`
- [ ] return the counts as JSON

`app/scratch-04/page.tsx` must:
- [ ] be a client component (`'use client'`)
- [ ] hold state for: the current `jobId`, the latest `JobResponse`, and the counts
- [ ] on submit: POST the `FormData` to your producer route, read back the `jobId`, reset any old job state
- [ ] **poll the job** in a `useEffect`: tick immediately + every ~1s; **stop** when the job is terminal (`completed`/`failed`/error); clean up the interval on unmount
- [ ] handle a `404` from the status route *without* wiping the last good state (the housekeeping trap)
- [ ] **poll the counts** in a separate `useEffect` (independent of any single job)
- [ ] render: the form, a counts readout, a `<progress>` bar while running, an error message on `failed`, the result `<img>` on `completed`

APIs / things to look up:
- React `useState` / `useEffect`, `setInterval` + cleanup, the correct form-event type (the old rung-04 used `React.SubmitEvent`, which isn't a real React type — find the right one)
- `fetch` with `FormData` body; `URLSearchParams`/path interpolation for the job id

Gotchas to get right (these are the lesson):
- **What's in your effect's dependency array?** Getting this wrong causes either no polling or a runaway loop.
- **When exactly do you tear down the interval?** (terminal state *and* unmount)
- **Why poll counts separately from the job?** (counts are queue-wide, not tied to your one job)

Verify when done:
- submit → progress bar climbs → result image appears; polling stops after completion (check the Network tab — no more requests)
- the counts readout moves as you submit/process jobs
- a failed job shows the error, doesn't spin forever

</details>
