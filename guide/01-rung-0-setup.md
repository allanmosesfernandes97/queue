# Rung 0 — Setup (mechanical, get through it fast)

**Goal:** A Next.js app with the right deps installed, and Redis running in Podman.

**Steps:**

1. `pnpm create next-app@latest queue-school` — accept TypeScript, ESLint, Tailwind, App Router, no `src/`, default import alias.
2. `cd queue-school && pnpm add sharp bullmq ioredis zod`.
3. `pnpm add -D tsx` (so you can run a standalone TS worker script later).
4. `podman run -d --name queue-school-redis -p 6379:6379 redis:7-alpine`.
5. Verify: `pnpm dev`, see the default Next page. `podman ps`, see Redis running.

**Done when:** Next page loads on localhost:3000, Redis container is up.