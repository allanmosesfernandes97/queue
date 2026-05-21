# Appendix

## When you get stuck

For each library, you only need a small surface — search for these exact terms:

- Next.js App Router: "route handler POST formData", "dynamic route params Next 16", "route runtime nodejs"
- sharp: "sharp resize toBuffer"
- BullMQ: "Queue.add options", "Worker concurrency limiter", "job updateProgress", "getJobCounts", "removeOnComplete"
- ioredis: "ioredis maxRetriesPerRequest null bullmq" — this one is the most common gotcha

Do **not** open Redis docs. If you find yourself there, that's the scope-creep instinct firing — close the tab.

---

## Where to go next (after you finish)

Name-only, so you have a map:

- **SSE / WebSockets / webhooks** — replace polling with push.
- **Cross-machine workers** — the same `pnpm worker` script on three boxes pointed at the same Redis. Identical to rung 4 #6, just different IPs.
- **Job replay tooling** — when a DLQ piles up, how do you re-run them after fixing the bug? BullBoard does this. Build your own button for it.
- **Job scheduling / repeating jobs** — `queue.add(name, data, { delay: 60_000 })` for "run in 1 minute"; `queue.upsertJobScheduler(...)` for cron-style repeats.
- **Multi-stage pipelines / fan-out** — one job produces N sub-jobs. BullMQ's "flows" feature.
- **A different substrate** — once you've done this in BullMQ, try the same shape with `pg-boss` (Postgres-backed) or AWS SQS. The producer/consumer mental model is identical; you'll learn the substrate-specific quirks in an hour because the shape transfers.
