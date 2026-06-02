# Flagship — "Repurpose" : an AI content pipeline

A portfolio project to showcase backend/distributed-systems judgement to London
startups. The product is a hook; the **queue architecture, reliability, and
observability** are the real exhibit.

> **Product in one line:** upload a podcast/video → background workers transcribe
> it, summarise it, and generate social-post variants + thumbnails → a live
> dashboard shows the whole pipeline working, recovering from failures, and
> scaling across workers.

## Why this project gets you hired (not just "a CRUD app")

- It uses a queue because it **has to** — AI/transcription calls are slow,
  flaky, rate-limited, and expensive. That's senior-correct, not contrived.
- It lets you *demonstrate* (not just claim) retries, backoff, DLQ, rate
  limiting, idempotency, fan-out, and horizontal scaling — each tied to a real
  feature.
- The **ops dashboard + architecture diagram** is the differentiator. Most
  candidates show a UI; you'll show a system you can reason about under load.
- The deployment topology (serverless producer + long-lived workers) is itself a
  strong interview answer.

## How to use this workbook (Socratic — same as scratch-04)

Each file: **Concept** → **Questions** you answer in `> Your answer:` blocks →
collapsed **Model answers** to self-grade → sometimes a collapsed **reference
sketch**. Reason first, reveal second. This is a *design* workbook — the goal is
that you can whiteboard this system and defend every choice.

If an LLM picks this up: enforce the Socratic contract from
`../guide/scratch-04/README.md` — quiz before revealing, grade honestly, teach
the *why*, one checkpoint at a time.

## The files

| # | File | What you decide |
|---|---|---|
| 00 | `00-product-scope.md` | Ruthless v1 scope — what you build vs. cut |
| 01 | `01-architecture.md` | The boxes and why; why serverless can't run the worker |
| 02 | `02-queue-topology.md` | One queue or many; how fan-out + job dependencies work |
| 03 | `03-data-model.md` | What lives in Redis vs Postgres vs blob storage, and why |
| 04 | `04-pipeline-jobs.md` | Each job type, its provider, its retry/rate-limit profile |
| 05 | `05-reliability.md` | Idempotency, at-least-once, DLQ strategy, cost control |
| 06 | `06-observability.md` | The dashboard that is your edge; real-time vs polling |
| 07 | `07-deployment.md` | Vercel + Railway/Render + Upstash/Redis + R2; scaling, gotchas |
| 08 | `08-build-plan.md` | Phased milestones, what to demo, how to frame it on your CV |

## Prerequisite

You should have finished `guide/scratch-04` (or at least understand: queue lives
in Redis, producer/consumer split, retries/backoff, DLQ, rate-limit, atomic
claim / horizontal scaling). This builds directly on all of it.

## Tech stack (decided — reason about them in the checkpoints, don't bikeshed now)

- **Next.js** (producer API + dashboard UI) → deployed on **Vercel**
- **BullMQ + Redis** (the broker) → **Upstash** or **Railway Redis**
- **Worker(s)** (long-lived Node processes) → **Railway / Render / Fly.io**
- **Postgres** (durable domain state) → **Neon** or **Railway Postgres**, via **Prisma** or **Drizzle**
- **Blob storage** (media + artifacts) → **Cloudflare R2** (no egress fees) or S3
- **AI providers** — transcription (Whisper API / Deepgram), LLM (Claude / OpenAI)
