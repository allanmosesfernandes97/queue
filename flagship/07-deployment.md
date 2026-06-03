# Checkpoint 07 — Deployment & operations

## Concept

A live URL is the difference between "a repo" and "a project." But the topology
(serverless producer + persistent workers + managed Redis + blob) has real
gotchas. Getting this working — and being able to explain it — is itself a strong
hireable signal.

## Questions

**Q1.** Map each component to a concrete host and say why it *can't* just all go
on Vercel:
Next.js app · worker(s) · Redis · Postgres · blob storage.

> Your answer:

**Q2.** **Deploys kill processes.** When you push a new version, your worker
host restarts the worker — possibly mid-job. What signal does it send, what must
your worker do in response, and what did scratch-04's worker already get right
here?

> Your answer:

**Q3.** **The Upstash gotcha.** Serverless Redis (Upstash) bills per command and
caps concurrent connections; BullMQ is *chatty* (lots of commands, blocking
connections, multiple connections per Queue/Worker/QueueEvents). What problems
might you hit on a free tier, and when would you pick Railway/Fly Redis instead?

> Your answer:

**Q4.** How do you **scale workers** on Railway/Render in practice, and how does
that connect to the exact thing you proved in scratch-04 scenario 6? What has to
be true about your worker code for "just run more of them" to be safe?

> Your answer:

**Q5.** **Secrets & config.** List what must be in environment variables (not in
code), and note which differ between the Vercel app and the worker host.

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.**
- **Next.js → Vercel.** Serverless, great for the producer + dashboard.
- **Worker(s) → Railway / Render / Fly.io.** Must be a **long-lived process**
  (parked on a blocking Redis pull) — serverless kills it. *This is the crux.*
- **Redis → Upstash or Railway/Fly Redis.** Managed broker reachable by both.
- **Postgres → Neon or Railway Postgres.** Durable domain truth.
- **Blob → Cloudflare R2 (no egress fees) or S3.**
Can't be all-Vercel because the worker fundamentally needs a persistent runtime
Vercel doesn't provide.

**Q2.** The host sends **`SIGTERM`** (then `SIGKILL` after a grace period). The
worker must call **`worker.close()`** to stop taking new jobs and let in-flight
jobs finish within the grace window — exactly the graceful-shutdown handler
scratch-04's worker already had (`process.on('SIGTERM', () => worker.close())`).
Anything still running when `SIGKILL` lands is interrupted, but stall detection
redelivers it — *if* your processor is idempotent (checkpoint 05). So: graceful
shutdown handles the clean case; idempotency handles the ugly case. You need both.

**Q3.** BullMQ opens **multiple** Redis connections (Queue, each Worker, each
QueueEvents) and issues many commands (blocking pulls, lock renewals, polling).
On Upstash free tier you can hit the **connection cap** quickly (several workers ×
several connections each) and rack up **per-command costs** from the chatter.
For a worker-heavy app like this, a **dedicated Redis** (Railway/Fly, flat-rate,
generous connections) is often the better fit; Upstash shines for light,
serverless-only workloads. Knowing this trade-off — *"BullMQ is chatty, so I'd
use flat-rate Redis for a worker fleet"* — is a real ops signal.

**Q4.** On Railway/Render you scale by **increasing the replica/instance count**
of the worker service (or running multiple worker services, one per queue type).
Each replica is another process running the *same* worker code, all pulling from
the *same* Redis queue — which is **literally scratch-04 scenario 6**, just in
the cloud. For "run more of them" to be safe, the worker must be **stateless**
(no in-memory state that assumes it's the only worker) and **idempotent** (atomic
claim prevents double-processing, but redelivery can still re-run a job). Same
code, more processes, more throughput — the payoff of the whole rung.

**Q5.** Env vars (never in code):
- Both: `REDIS_URL`.
- App (Vercel): `DATABASE_URL`, blob credentials (or presign signing key), maybe
  `NEXT_PUBLIC_*` for the dashboard.
- Worker: `DATABASE_URL`, blob credentials, **AI provider API keys**
  (transcription + LLM — these live on the *worker*, which makes the calls, not
  the public app), `*_CONCURRENCY`, `*_RATE_PER_SEC`.
Note the AI keys belong on the **worker host**, not the public Vercel app — the
worker is the only thing calling those APIs, and keeping keys off the
public-facing deployment reduces exposure.

</details>
