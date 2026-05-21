# Overview

## Context

You're a frontend engineer aiming for staff. The "polling / jobs / queues" cluster of patterns shows up everywhere in real systems but is invisible until you've built one. The intimidation is mostly vocabulary — the mechanics are simple once you've felt the failure modes that motivate each pattern.

You build **one project** that climbs four rungs. Each rung works, breaks in a specific way, and that breakage is the *whole point* — it tells you why the next rung exists. You are not aiming for production polish; you are aiming for **a mental model that survives any framework choice**.

Stack: **Node + Next.js**, **image resize** as the simulated work, **Redis in Podman** as the queue backend on rung 4.

This guide is concepts, signposts, and verification checkpoints — **no code**. You write every line. When you get stuck, search the official docs of whichever piece you're using; the API surface you need is tiny and named explicitly below.

---

## What you are NOT learning here

- **Redis itself.** A black box. You start it, BullMQ talks to it, you never write a Redis command. Resist the urge to read Redis docs.
- **`sharp`'s API surface.** One method chain: open → resize → output. Don't fall into image-processing land.
- **BullMQ's full feature set.** You'll use ~6 things. It has dozens. Ignore the rest.
- **Deployment, scaling, monitoring stacks.** All local-dev.

When a new noun appears that isn't in the lesson goal, the default is: *"I will use this without understanding it deeply, and that is correct."*

---

## Suggested pace

Each rung is one focused session. Don't binge — let each rung sit overnight before moving on. The "oh" moments tend to land when you come back fresh.

- Day 1: Rung 0 + Rung 1 (90 min). The pain rung.
- Day 2: Rung 2 (90 min). The receipt rung.
- Day 3: Rung 3 (60 min). The producer/consumer rung.
- Day 4: Rung 4 (2 hours). The Redis rung.
- Day 5: Re-read the staff-level concepts section and check that each one points at a specific moment in *your* code.

If you can explain rungs 1–4 to another engineer using just the words in this guide, you've absorbed it. Try that as the final check.
