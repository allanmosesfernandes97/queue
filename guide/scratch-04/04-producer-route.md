# Checkpoint 04 — `app/scratch-04/api/route.ts` (the producer)

## Concept

POST handler: parse upload → base64 → `queue.add(name, data, opts)`. The `opts`
is where retries, DLQ, and housekeeping are **declared** (even though they
*happen* in the worker). Returns a receipt the client can poll.

## Questions

**Q1.** Return `202` not `200` — what does **202** specifically promise the
client, and why is it the *honest* code here given nothing is resized yet?

> Your answer:

**Q2.** We pass our own `jobId = randomUUID()` instead of letting BullMQ assign
one. What does the client need it for? Bonus: what does BullMQ do if the same
`jobId` is added twice (idempotency / dedup)?

> Your answer:

**Q3.** `attempts: 3`, `backoff: { type: 'exponential', delay: 1000 }`.
(a) What does each cause, and **which process performs the retry** — this route
or the worker? (b) Roughly what are the waits before attempt 2 and attempt 3?

> Your answer:

**Q4.** `removeOnComplete: { age: 3600, count: 100 }`, `removeOnFail: { age: 86400 }`.
(a) Why remove finished jobs at all — what accumulates and where? (b) Why keep
**failed** jobs *longer* than completed ones?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** **202 Accepted** = "I've accepted your request for processing; it isn't
done yet." `200 OK` would lie — no image exists yet. 202 is the standard code for
async/queued work and tells the client to go poll the status endpoint. Honest
contract between server and client.

**Q2.** The client needs the id as a **receipt** to poll
`GET /scratch-04/api/job/:id`. Bonus: BullMQ **dedupes on `jobId`** — adding a
job with an id that already exists is a **no-op** (the second add is ignored).
That gives you idempotency: a double-clicked submit or a retried network request
won't enqueue the same work twice. (Auto-generated ids can't give you that,
because each call gets a fresh id.)

**Q3.** (a) `attempts: 3` = try the processor up to 3 times before giving up.
`backoff exponential, delay 1000` = wait a growing delay between attempts. The
**worker** performs the retry: when the processor throws, the worker catches it,
moves the job to `delayed`, and re-runs the processor after the backoff. The POST
route is long gone — it returned 202 immediately. (b) Exponential ≈
`delay * 2^(attempt-1)`: ~**1000 ms** before attempt 2, ~**2000 ms** before
attempt 3 (some setups count from 0 → 1000/2000; either way it grows).

**Q4.** (a) Redis is **RAM**. Completed/failed jobs (and their data) stay in
Redis forever unless trimmed → unbounded memory growth → eventual OOM. `age`
(seconds) and `count` (keep last N) bound the retained set. (b) **Failed jobs are
your DLQ** — you keep them longer for human inspection, debugging, and replay.
Completed jobs carry no diagnostic value, so trim them aggressively. (The
"dead-letter queue" is literally just the `failed` set after attempts are
exhausted — not a separate queue.)

</details>

<details>
<summary>Build checklist (write the file yourself — no solution here)</summary>

Your `app/scratch-04/api/route.ts` must:
- [ ] export an `async function POST(req: Request)`
- [ ] read the multipart body and pull out the `image` field and the `fileName` field
- [ ] **validate**: `image` is a real `File` with size > 0, `fileName` is a non-empty string → otherwise return `400`
- [ ] turn the file into a `Buffer`, then into a base64 string (the lesson shortcut)
- [ ] generate your own `jobId`
- [ ] `add()` the job to `queueScratch04` with data `{ fileName, base64 }` and opts: `jobId`, `attempts`, `backoff` (exponential), `removeOnComplete`, `removeOnFail`
- [ ] return the `jobId` as JSON with status **202**

APIs to look up (practise reading the docs — don't memorise):
- `Request.formData()`, `File.arrayBuffer()`, `Buffer.from(...).toString('base64')`
- `randomUUID` from `node:crypto`
- BullMQ `queue.add(name, data, opts)` — check the exact shape of `backoff`, `removeOnComplete`, `removeOnFail`

Verify when done:
- POSTing the form returns `202` + a `jobId`
- the job appears in the worker terminal / the dashboard's `waiting`→`active` counts
- submitting twice with the *same* `jobId` does **not** create a second job (dedup)

</details>
