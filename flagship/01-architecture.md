# Checkpoint 01 — The architecture (the boxes and the why)

## Concept

Before any code, you must be able to draw the system on a whiteboard: which
processes exist, what each owns, and what crosses the wire between them. The
shape is forced by one hard constraint about serverless.

## Questions

**Q1.** Draw (in words) every running process/service in production and what each
is responsible for. There should be at least: the Next.js app, Redis, the
worker(s), a database, blob storage. For each, one sentence: *what does it own?*

> Your answer:

**Q2.** **The constraint that shapes everything:** why can't your worker live
inside the Next.js app deployed on Vercel? What is it about serverless functions
that's fundamentally incompatible with how a BullMQ worker operates? (Tie this
back to the *blocking pull* from scratch-04.)

> Your answer:

**Q3.** You're introducing a **Postgres database** that scratch-04 didn't have.
Redis already stores job state — so why do you need a separate durable DB? What
does Postgres own that Redis must *not* be the source of truth for? (Hint:
`removeOnComplete` from scratch-04 checkpoint 05.)

> Your answer:

**Q4.** When a user uploads a 50 MB audio file, trace its journey: where do the
bytes physically go, what does the *job* actually contain, and how does the
transcription worker get the audio when it's time to process? (Apply the
checkpoint-03 lesson about not putting blobs in Redis.)

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** The processes and their ownership:

- **Next.js app (Vercel)** — *producer + dashboard*. Accepts uploads, writes the
  file to blob storage, creates the domain record in Postgres, enqueues jobs,
  serves the status/dashboard UI. Returns fast; does **no** heavy work.
- **Redis (Upstash/Railway)** — *the broker*. Holds the queues and transient job
  orchestration state. The dead drop both sides address by name.
- **Worker(s) (Railway/Render/Fly)** — *the consumer(s)*. Long-lived processes
  that pull jobs, call AI providers, run media processing, write results to
  Postgres + blob. Scale by running more of them.
- **Postgres (Neon/Railway)** — *durable domain state*. Users (if any), uploads,
  the canonical status + results (transcript, summary, posts). The source of
  truth your product reads from.
- **Blob storage (R2/S3)** — *the bytes*. Raw uploads and generated artifacts
  (thumbnail images, maybe audio chunks).

**Q2.** A BullMQ worker's whole life is **parked on a blocking Redis command**,
waiting indefinitely for the next job — it's a *long-lived process holding an
open connection*. **Serverless functions are the opposite**: they spin up to
handle one request, are billed per-invocation, are killed after seconds of
inactivity, and can't hold a persistent connection or run a background loop
between requests. A worker on Vercel would be killed mid-wait (or never start
its loop at all). So the worker **must** run somewhere that allows long-running
processes — Railway/Render/Fly. This split (serverless producer + persistent
worker) is the canonical topology and a great interview talking point.

**Q3.** Redis/BullMQ job state is **transient by design** — `removeOnComplete`
and `removeOnFail` housekeep jobs away so Redis (RAM) doesn't grow forever. If
your product read results from BullMQ, the user's transcript would *vanish* an
hour after completion. So: **Redis owns orchestration (where is this job in its
lifecycle, right now); Postgres owns the durable truth (this upload exists, here
is its final transcript/summary/posts, forever).** The worker mirrors status into
Postgres as it goes and writes results there on success. The dashboard's *live*
counts come from Redis; the *product* reads from Postgres. (This is exactly the
"404-after-removeOnComplete" trap from scratch-04, solved structurally.)

**Q4.** Journey of the 50 MB file:
1. Browser uploads to the Next.js route (or, better, directly to blob storage via
   a **presigned URL** so 50 MB doesn't pass through your serverless function and
   blow its body-size/time limits).
2. Bytes land in **blob storage**; you get back a **key/URL**.
3. Next.js creates an `Upload` row in **Postgres** and enqueues a job whose
   `data` contains only the **blob key + upload id** — *never the audio bytes*
   (checkpoint 03: blobs in Redis = RAM blowup + re-serialization on every read).
4. The transcription worker pulls the job, reads the key, **fetches the audio
   from blob storage**, streams it to the transcription API, writes the transcript
   to Postgres/blob, updates status.

The job is a tiny envelope pointing at the real data — the queue stays lean.

</details>

<details>
<summary>Reference architecture sketch</summary>

```
                 presigned PUT
   Browser ───────────────────────────────► Blob storage (R2/S3)
      │                                         ▲   │
      │ POST /upload (metadata + blob key)      │   │ fetch audio / write artifacts
      ▼                                         │   ▼
  ┌─────────────────────────┐   enqueue    ┌─────────┐   pull   ┌──────────────────┐
  │ Next.js (Vercel)        │ ───────────► │  Redis  │ ───────► │ Worker(s)        │
  │  • producer API         │              │ (BullMQ)│ ◄─────── │ Railway/Render   │
  │  • dashboard UI (polls) │ ◄─────────── │ queues  │  status  │  • transcribe    │
  └───────────┬─────────────┘  counts/state└─────────┘          │  • summarise     │
              │                                                  │  • thumbnail     │
              │ read product data            write results       └────────┬─────────┘
              ▼                                                            │
        ┌───────────┐  ◄──────────────────────────────────────────────────┘
        │ Postgres  │   durable truth: uploads, status mirror, transcript, summary, posts
        └───────────┘
```

</details>
