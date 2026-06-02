# Checkpoint 03 — Data model: Redis vs Postgres vs blob

## Concept

Three storage layers, three different jobs. Putting the wrong data in the wrong
layer is the most common architecture mistake in queue-backed systems. You must
be able to say *exactly* what each layer owns and why.

## Questions

**Q1.** For each piece of data below, say which layer it belongs in (blob /
Postgres / Redis-BullMQ) and one reason:
(a) the raw uploaded audio, (b) the queue of pending transcription jobs,
(c) the final transcript text, (d) "this job is currently at 60%", (e) the list
of generated social posts, (f) the generated thumbnail image, (g) "upload #123
has status `processing`".

> Your answer:

**Q2.** Status appears twice — BullMQ knows a job's state, *and* you're storing
status in Postgres (d vs g above). Isn't that duplication? Explain why it's
deliberate, and which one the **product UI** reads vs. which the **ops dashboard**
reads.

> Your answer:

**Q3.** Sketch the Postgres tables for v1. What's the minimum set, and how do they
relate? (Think: an upload, and the artifacts produced from it.)

> Your answer:

**Q4.** When the `summarise` worker finishes, it has a summary string. Walk
through every write it performs and to which layer — and what the producer/UI
does to make that summary appear on screen.

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.**
- (a) raw audio → **blob** (large binary; cheap object storage; never in Redis/DB).
- (b) pending transcription jobs → **Redis/BullMQ** (that *is* the queue).
- (c) transcript text → **Postgres** (durable product data; could also cache a
  copy in blob if huge, but it's queryable truth → DB).
- (d) "job at 60%" → **Redis/BullMQ** (transient orchestration; `job.progress`).
- (e) social posts → **Postgres** (durable product output).
- (f) thumbnail image → **blob** (binary artifact), with its key stored in Postgres.
- (g) "upload #123 is `processing`" → **Postgres** (durable status the product
  relies on, mirrored from BullMQ).

**Q2.** Not accidental duplication — **two different consumers with two different
durability needs.** BullMQ's job state is *live but transient* (housekept away by
`removeOnComplete`); it answers "what is happening right now" for the **ops
dashboard**. Postgres status is *durable forever*; it answers "what is the state
of this upload" for the **product UI**, long after the BullMQ job is gone. The
worker **mirrors** state into Postgres at each transition (e.g. on `active` →
`processing`, on `completed` → `done`). Product reads Postgres; dashboard reads
Redis. (Directly solves scratch-04's 404-after-housekeeping trap.)

**Q3.** Minimum tables:

```
uploads        id, filename, blob_key, status, created_at
transcripts    id, upload_id (FK), text, language, created_at
summaries      id, upload_id (FK), text, created_at
social_posts   id, upload_id (FK), platform, text, created_at
artifacts      id, upload_id (FK), kind ('thumbnail'), blob_key, created_at
```

`uploads` is the aggregate root; everything else FKs back to it. `status` on
`uploads` is the mirrored lifecycle (`uploaded → processing → done | failed`).
(You can collapse `transcripts`/`summaries` into `uploads` columns for v1 if you
want fewer tables — defensible either way; separate tables scale better and read
cleaner.)

**Q4.** The `summarise` worker:
1. Writes the summary row to **Postgres** (`summaries`, FK to upload).
2. Optionally updates `uploads.status` if this was the last step.
3. Returns the summary (or an id) as the job's `returnvalue` → **Redis**
   (so the next chained job / Flow parent can read it, and the dashboard shows
   `completed`).

The **UI** doesn't watch the worker — it **polls** (or subscribes to) a status
endpoint that reads **Postgres**; when `summaries` has a row for the upload, the
summary renders. Worker → Postgres → polled endpoint → UI. Same relay pattern as
scratch-04, just Postgres is the durable hand-off instead of `job.returnvalue`.

</details>
