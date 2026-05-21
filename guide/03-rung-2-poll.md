# Rung 2 — Submit + Poll (the receipt pattern)

## The concept

Decouple "I asked for work" from "the work is done." The POST returns immediately with a **job ID** (a receipt). The work runs in the background on the server. The client polls a status endpoint until the job is done, then renders the result.

This is the rung where the whole mental model shifts. Everything afterward is a refinement.

## What you build

- **State store**: an in-memory `Map<jobId, JobState>` in `lib/store-rung-2.ts`. `JobState` has at least `id`, `status: "pending" | "processing" | "done" | "failed"`, `progress: number`, `resultDataUrl?: string`, `error?: string`.
- **POST route** `app/rung-2-poll/api/jobs/route.ts`: parse the file, generate a UUID, insert a `"pending"` entry into the store, **fire-and-forget** the actual work (don't `await` it), return `{ jobId }` with HTTP 202.
- **GET route** `app/rung-2-poll/api/jobs/[id]/route.ts`: read from the store, return current state.
- **Client page**: submit form → kick off poll loop with `setInterval` at 1s → render progress bar → when status is `"done"`, show the result image.

## The two non-obvious bits

1. **Fire-and-forget** — your POST handler should call the work function *without `await`* (a common pattern: `void doWork(id, buffer)`). The handler returns, the work continues. This only works because Node.js will keep your async function running after the response is sent.

2. **Progress reporting** — to fake progress, break the 8-second fake delay into ~10 ticks, each updating the job's `progress` field. Your sharp call at the end goes from 90 → 100. This is the same shape real progress takes (long phases + a final cap).

3. **Return the image** — easiest path: when work is done, encode the result as base64 and stuff it into `resultDataUrl: data:image/jpeg;base64,...`. The GET endpoint returns this as part of the JSON. The client renders `<img src={resultDataUrl} />`. (In production you'd put the image in blob storage and return a URL. For this lesson, inline.)

## Pointers

- `crypto.randomUUID()` from `node:crypto`.
- Next.js dynamic route param: the second arg of GET has `{ params: Promise<{ id: string }> }` — **`params` is a Promise in modern Next.js**. You must `await` it.
- HTTP 202 = "Accepted, processing." Use this for the POST response. (Status codes are a real part of the API contract; using 200 here is technically wrong.)
- `setInterval` in a React `useEffect` — remember to clear it on unmount and when the job reaches a terminal state.

## Verify the lesson lands

- [ ] **The "oh" moment:** submit a job, copy the job ID from the response, close the browser tab, open a new tab, navigate to a tiny form on the same page where you can paste a job ID and start polling — the work ran on the server while no client was watching. Build this. It's the whole point.
- [ ] Submit 10 jobs in quick succession. All 10 run in parallel — no concurrency control, no backpressure. CPU pins.
- [ ] Ctrl-C the dev server. Restart with `pnpm dev`. Try to poll the previous job — gone. State lived in `process.memory`. This is fine for the lesson but fatal in production.

## The lesson

The job ID is a receipt. The server doesn't need the client to be present to do the work. The polling endpoint is how the client checks in. **Almost every async-job system in the world boils down to: receipt + status endpoint + result delivery.** The differences are where you store the state and who runs the work.
