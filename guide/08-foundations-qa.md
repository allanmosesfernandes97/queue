# Foundations — Redis, BullMQ & the Wire (interview Q&A)

Flashcard-style recap of the concepts behind rung-4. Read the question, answer it
out loud, then check. These are the gaps that trip people up *before* the code.

---

## Queues (the rung-3 → rung-4 mental model)

**Q: What are the three roles in any queue system?**
- **Producer** — creates work, only adds it to the queue (your POST handler → `enqueue`).
- **Queue** — the data structure holding pending work.
- **Consumer / worker** — pulls work off and processes it, with a concurrency limit.
> This shape is universal: Sidekiq, Celery, BullMQ, SQS, RabbitMQ, Kafka. Substrate changes, shape doesn't.

**Q: What did you hand-roll in rung-3 and what was wrong with it?**
A queue as an in-memory `Array`, a `Map` for status, and an `active` counter + `tick()` loop as a hand-rolled concurrency limiter (a semaphore). The flaw: it all lives **inside one Node process** — one process is a hard ceiling, and a crash erases the queue + any in-flight work.

**Q: What does rung-4 change, in one sentence?**
It swaps the in-process `Array` for a queue living in a **separate program (Redis)** that survives crashes and that many processes can share.

---

## Redis

**Q: Is Redis a database or a server?**
Both — they answer different questions. *What is it?* → an in-memory database (key-value store, data in RAM). *How is it reached?* → as a server (a long-running process listening on port `6379`). Every database is both (Postgres = database, runs as a server on `5432`).

**Q: Why is Redis fast?**
Data lives in **RAM**, not on disk. Plus it's purpose-built for this kind of work with a minimal wire protocol.

**Q: Does Redis push data to my app?**
No. **Clients initiate.** Your Node process (client) opens a connection and sends commands; Redis (server) answers. Same request/response direction as an API call.

**Q: How do two separate processes share a queue through Redis?**
Each process (your API and your worker) independently opens its own connection to the **same** Redis. Neither knows the other exists — Redis is the shared ground between them.

---

## BullMQ

**Q: Is BullMQ standalone? Does it need Redis?**
Not standalone. BullMQ is a **library** with no storage of its own. It needs Redis for everything — every job, its state, progress, retries all live in Redis. BullMQ just sends commands to it.

**Q: Direction of dependency?**
Redis runs fine without BullMQ (it's just a database). BullMQ does nothing without Redis (it throws a connection error).

**Q: Why use BullMQ instead of reading/writing Redis directly?**
Because raw Redis only gives you primitives (`LPUSH`/`BRPOP` ≈ an array with a socket). Turning that into a *correct* queue means solving the hard parts yourself:
- **Atomic claim** — stop two workers grabbing the same job (needs Lua scripts; you got this free in rung-3 only because JS is single-threaded).
- **Crash recovery** — a worker dies mid-job; the job must return to `waiting`, not vanish (lease/lock with expiry).
- **Retries + backoff, DLQ, delayed jobs, rate limiting, progress, events.**
> "Writing it directly" doesn't skip a layer — it means **re-implementing BullMQ yourself**. BullMQ *is* the queue logic; Redis is just the storage it runs on.

**Q: Analogy?**
Same reason you use Postgres transactions instead of reading/writing files and hoping requests don't clobber each other. The store gives primitives; the correct abstraction on top is worth importing.

---

## Sockets, TCP, HTTP

**Q: Is "socket" an alternative to HTTP?**
No — common misconception. **HTTP runs on top of a TCP socket.** A socket is the lower-level pipe; HTTP is one *language* spoken over it.

**Q: The layer stack?**
```
HTTP / RESP / ...   ← application protocol (the "language")
      │
     TCP            ← reliable, ordered byte stream (the "phone line")
      │
   socket           ← your program's handle to one end of the connection
      │
     IP             ← addressing/routing
```

**Q: What is a socket, in one line?**
The OS handle to one end of a network connection — the thing your program reads from and writes to.

**Q: Real difference between how HTTP and Redis use a socket?**
- **HTTP (classic):** open → request → response → done. Short, **stateless**, one-shot.
- **Redis (RESP) / WebSocket:** open **once**, keep it open, exchange many messages both ways. **Persistent** and **duplex** (either side can send anytime).

**Q: Does Redis use TCP?**
Yes. Throughout this guide, "socket" = TCP socket. (Sockets can also be UDP/Unix, but ignore that here.)

**Q: Caveat to "HTTP is never persistent"?**
HTTP/1.1 keep-alive reuses a socket for several requests, and WebSockets upgrade an HTTP connection into a persistent duplex one. The rule isn't absolute — but "HTTP = request/response, Redis = open line" is the right model.

---

## RESP

**Q: What is RESP?**
**REdis Serialization Protocol** — Redis's wire language, its equivalent of HTTP, but tiny and fast. The format of the bytes sent over the socket.

**Q: What does it look like?**
Type-prefixed and length-counted. `SET name allan` becomes:
```
*3      (array of 3)
$3 SET
$4 name
$5 allan
```
Reply: `+OK`. Prefixes: `*` array, `$` bulk string, `+` simple string, `-` error, `:` integer.

**Q: Do I ever write RESP?**
Never. `ioredis` encodes/decodes it. You call `redis.set('name','allan')`; it handles the bytes — same as calling `fetch()` without assembling raw HTTP.

**Q: The full chain?**
```
your JS → ioredis (encodes to RESP) → RESP bytes → TCP socket → Redis
```

---

## Deployment: managed & serverless

**Q: Does "serverless" mean no server?**
No. It means **you don't manage the server** — no box to provision/patch/scale; pay per use. A Redis process still runs; the provider hides it.

**Q: ElastiCache vs ElastiCache Serverless vs Upstash?**
| | Protocol | Connection | Good for |
|---|---|---|---|
| Local Docker Redis | RESP/TCP | persistent socket | learning, BullMQ |
| **ElastiCache** | RESP/TCP | persistent socket | servers / Lambda-in-VPC; **not** edge |
| **ElastiCache Serverless** | RESP/TCP | persistent socket | auto-scaling managed Redis |
| **Upstash** | RESP/TCP **and** HTTP | socket *or* per-request | both — BullMQ over TCP, edge over HTTP |

**Q: What does "Upstash works over HTTP too" mean — and why does it matter?**
Classic Redis only speaks RESP over a persistent TCP socket. Serverless/edge functions are short-lived and often **can't open raw TCP** — they only do HTTP. Upstash bolts an **HTTP/REST door** onto Redis so edge functions can run commands as ordinary HTTP requests. "Too" = it supports **both** RESP/TCP *and* HTTP.

**Q: Can BullMQ use the HTTP door?**
**No.** BullMQ needs raw TCP (blocking commands, Lua scripts, pub/sub). So your rung-4 worker connects to Upstash over its **TCP/RESP** endpoint, exactly like local Docker. The HTTP API is for lightweight edge use (a quick cache `GET`/`SET`, a rate-limit counter) — not BullMQ.

**Q: Does any of this change my rung-4 code?**
No. Your app connects to a `REDIS_URL` over a socket. Local Docker, ElastiCache, or Upstash — same connection, same BullMQ calls. Managed-vs-serverless is a deployment choice (who runs Redis), not a code change.

---

## One-breath summary

> A **socket** is the pipe; **TCP** makes it reliable; **RESP** is the language Redis speaks over it; **ioredis** speaks RESP for you; **Redis** is an in-memory database running as a separate server that holds the queue; **BullMQ** is the library that turns Redis's raw primitives into a correct, crash-surviving, multi-process queue. Your rung-3 `tick()` loop was the single-process sketch of exactly that.
