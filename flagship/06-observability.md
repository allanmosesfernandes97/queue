# Checkpoint 06 — Observability: the dashboard that is your edge

## Concept

This is the part that turns a side project into a *hireable* showcase. Anyone can
build the user-facing UI. A live **ops dashboard** — queue depth, throughput,
retries, DLQ, active workers, updating in real time — lets an interviewer *watch
your distributed system work* and triggers a 10-minute systems conversation you
control.

## Questions

**Q1.** What should the dashboard show? List the metrics, and for each, *what
decision it would drive* for an operator. (A metric you can't act on is noise.)

> Your answer:

**Q2.** **Polling vs. push** for the dashboard. scratch-04 polled `getJobCounts`
every second. For a real-time dashboard, what does BullMQ offer that's better,
and what's the trade-off? When is polling still the right call?

> Your answer:

**Q3.** Build vs. buy: `bull-board` is an off-the-shelf BullMQ dashboard you can
mount in minutes. Should you use it, or build your own? Argue it *from the
perspective of what you're trying to prove to an employer.*

> Your answer:

**Q4.** Beyond queue metrics — what **business/product** metrics would make this
look like a real product on your dashboard (e.g. things an actual founder would
want)? Name three.

> Your answer:

**Q5.** How would you *deliberately demonstrate* resilience in a live demo? Design
a 2-minute "watch this" moment using the dashboard. (Tie back to scratch-04's six
scenarios.)

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** Actionable metrics:
- **Queue depth (`waiting`) per queue** → growing unbounded = workers can't keep
  up → scale workers / raise concurrency.
- **`active` count** → are workers actually busy, or idle/stuck?
- **Throughput (completed/min)** → capacity baseline; drops signal trouble.
- **Retry rate / `attemptsMade` distribution** → rising = a provider is flaky.
- **`failed` (DLQ) count + contents** → the alarm bell; needs human action.
- **`delayed` count** → backoff or rate-limit holding jobs; expected vs. runaway.
- **Active worker count** → did a deploy kill your fleet?
- **Per-job latency (p50/p95)** → is transcription getting slower?

**Q2.** BullMQ exposes **`QueueEvents`** — a stream of `completed`/`failed`/`progress`/`waiting`
events you can subscribe to and **push** to the browser via **Server-Sent Events
(SSE)** or WebSockets. Better latency and no constant polling load. Trade-off:
a persistent connection + subscription wiring + reconnect handling — more moving
parts. **Polling is still fine** for low-frequency counts or an MVP; a good
hybrid is poll counts every few seconds but push per-job progress via SSE.
Knowing *when each is appropriate* is the senior signal.

**Q3.** **Build your own (at least the headline view).** `bull-board` is great
operationally, but it's *someone else's code* — mounting it proves you can read a
README, not that you understand queues. A custom dashboard reading `getJobCounts`
+ `QueueEvents` proves you understand the mechanics. Pragmatic middle ground:
build your own clean dashboard for the demo/story, and *mention* "I'd run
bull-board internally in prod for deep debugging" — that shows you know the
ecosystem *and* can build. Best of both.

**Q4.** Product metrics that read as "real": uploads processed today, total audio
minutes transcribed, average time-from-upload-to-done, success rate %, estimated
$ spent on AI today. These make it feel like a product an operator runs, not a
toy — and "estimated spend" ties straight back to your cost-control design.

**Q5.** The "watch this" demo (map to scratch-04 scenarios 2, 3, 6):
1. Queue 20 uploads — dashboard shows `waiting` spike, `active` climb, throughput.
2. **Kill a worker mid-run** → point at the dashboard: jobs stall then redeliver,
   nothing lost (scenario 2 + stall detection).
3. **Start a second worker** → throughput visibly ~doubles, `waiting` drains
   faster (scenario 6, horizontal scaling — live).
4. **Flip on a fake provider failure** → watch `attemptsMade` climb with backoff,
   a job land in the DLQ, the alert fire (scenario 3 + 4).

Two minutes, entirely on the dashboard, and you've demonstrated crash-resilience,
scaling, retries, and DLQ *visually*. That's the interview.

</details>
