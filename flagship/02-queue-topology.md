# Checkpoint 02 — Queue topology & fan-out

## Concept

In scratch-04 you had **one queue, one job type**. Here, one upload spawns
several jobs, and some **depend on others** (you can't summarise before you
transcribe). How you model that — one queue vs. many, and how you express
dependencies — is the core design decision of this project.

## Questions

**Q1.** **One queue or many?** Argue it. Should `transcribe`, `summarise`, and
`thumbnail` all share one queue, or get separate queues? Think about what differs
between these job types: their *rate limits*, their *concurrency*, their *failure
modes*, and how independently you'd want to *scale* them.

> Your answer:

**Q2.** **Dependencies.** `summarise` needs the transcript that `transcribe`
produces. Name two different ways to make job B run only after job A finishes,
and pass A's output to B. What are the trade-offs?

> Your answer:

**Q3.** `thumbnail` doesn't depend on the transcript at all — it can run the
moment the file is uploaded. So in the dependency graph, is it parallel or
sequential to the transcription branch? Draw the graph for one upload.

> Your answer:

**Q4.** Failure isolation: if the transcription provider is down and every
`transcribe` job is retrying, do you want that to also stall `thumbnail` jobs for
*other* uploads? How does your one-queue-vs-many answer affect this?

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** **Separate queues per job type.** They differ on every axis that matters:
- *Rate limits:* transcription API and LLM API have different caps; you tune
  `limiter` per queue.
- *Concurrency:* `thumbnail` is CPU-bound (low concurrency, scale by process);
  `transcribe`/`summarise` are I/O-bound waiting on APIs (higher concurrency
  per process is fine).
- *Failure modes:* a flaky LLM shouldn't share a DLQ with media-processing bugs.
- *Scaling:* you might need 5 transcription workers but 1 thumbnail worker.
  Separate queues let you scale each independently — even run different worker
  *deployments* for each.

One shared queue would force one concurrency/limiter/DLQ for fundamentally
different work. Separate queues is the senior answer.

**Q2.** Two approaches:
- **(a) Job chaining:** each job, on completion, enqueues the next and passes the
  result forward (transcribe's `completed` handler enqueues `summarise` with the
  transcript id). *Pro:* dead simple, explicit, easy to reason about. *Con:* the
  orchestration logic is scattered across job handlers.
- **(b) BullMQ Flows (`FlowProducer`):** declare a *tree* of parent/child jobs up
  front; children run first, the parent runs only after all children complete and
  can read their results via `getChildrenValues()`. *Pro:* declarative, models
  fan-in cleanly, BullMQ handles the waiting. *Con:* more magic, leaves-run-first
  mental model takes a beat to get.

  Recommendation: **start with chaining** (you'll understand every step), then
  refactor to Flows once it works — and be able to explain *both* in an interview.

**Q3.** `thumbnail` is **parallel** to the transcription branch — both start from
the uploaded file. Graph for one upload:

```
upload
 ├── transcribe ──► summarise ──► generate-posts        (sequential branch)
 └── thumbnail                                           (independent, parallel)
```

`transcribe → summarise → generate-posts` is a sequential chain (each needs the
prior's output); `thumbnail` runs concurrently with the whole chain. The upload
is "done" when *both* branches finish.

**Q4.** You do **not** want a transcription outage to stall unrelated thumbnail
work. Separate queues give you exactly this isolation: `transcribe` jobs pile up
in `delayed`/retrying on *their* queue while the `thumbnail` queue drains
normally. If they shared a queue and a concurrency budget, retrying transcription
jobs could starve thumbnails. **Failure isolation is a primary reason to split
queues** — say this in an interview and you sound like you've run things.

</details>

<details>
<summary>Reference: queues for v1</summary>

```
Queue "transcribe"     — I/O-bound, rate-limited to provider cap, concurrency ~5
Queue "summarise"      — I/O-bound (LLM), rate-limited to TPM, concurrency ~3
Queue "generate-posts" — I/O-bound (LLM), shares LLM budget with summarise
Queue "thumbnail"      — CPU-bound, low concurrency, scale by process count

Flow (or chain): transcribe ─► summarise ─► generate-posts
Independent:      thumbnail (enqueued at upload time alongside transcribe)
```

</details>
