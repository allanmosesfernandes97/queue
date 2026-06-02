# Checkpoint 00 — Ruthless v1 scope

## Concept

The #1 way portfolio projects die is **scope creep** — you build forever, never
ship, never get the live link. A senior signal is *scoping discipline*: ship a
small thing that works end-to-end, then expand. Your v1 must be demoable on a
live URL with the queue story fully visible.

## Questions

**Q1.** List every feature the "full vision" could have (transcribe, summarise,
social posts, thumbnails, clips, multiple languages, user accounts, billing,
team workspaces, …). Now draw the line: what is the **smallest** version that
still demonstrates *all the queue concepts* (fan-out, retries, DLQ, rate-limit,
scaling)? Be specific about what you cut.

> Your answer:

**Q2.** Which single input media type should v1 accept, and why does picking
*one* matter? (Think about how many code paths each new type adds vs. how much it
adds to the *queue* story you're showcasing.)

> Your answer:

**Q3.** Does v1 need user accounts / auth? Argue both sides, then decide — what
does auth add to the *thing you're trying to prove*, and what does it cost you in
time-to-live-demo?

> Your answer:

---

<details>
<summary>Model answer</summary>

**Q1.** The queue concepts need exactly **a fan-out of ≥2 job types where some
depend on others, at least one slow+flaky external call, and one CPU-bound job.**
The minimum that hits all of it:

> **v1 = upload one audio file → (1) transcribe → (2) summarise + generate 3
> social posts (depends on transcript) → (3) generate a thumbnail. Show progress
> and a live queue dashboard.**

That gives you: fan-out + a real dependency (summary needs transcript), a slow
flaky API call (transcription → retries/backoff/rate-limit), a CPU-bound job
(thumbnail), and a DLQ when a file is unprocessable. **Cut for v1:** video,
clip-generation (ffmpeg video editing is a time sink), multi-language, billing,
team workspaces, editing/regenerating outputs. Those are "v2" line items you can
*mention* in the README roadmap — which itself signals product thinking.

**Q2.** **Audio only** (mp3/wav/m4a). One type = one validation path, one storage
path, one transcription path. Adding video roughly doubles the media-handling
code (ffmpeg, codecs, large files) while adding **nothing** to the queue/distributed-systems
story you're actually showcasing. Effort spent on codecs is effort not spent on
the part that gets you hired.

**Q3.** *For:* auth makes it feel like a real product and lets you scope jobs to a
user. *Against:* it adds signup/session/security surface that proves nothing
about queues and delays your live demo by days. **Decision:** skip real auth in
v1. Use a single shared demo space, or a trivial "enter a name" pseudo-session.
If you want polish later, add a one-click provider (Clerk/Auth.js) in v2. Don't
let the login page block the thing that actually demonstrates your skills.

**The meta-lesson:** every "no" in v1 is defensible in an interview —
*"I cut video because it adds media complexity without strengthening the
distributed-systems story, which is what this project is meant to demonstrate."*
That sentence is worth more than the feature.

</details>
