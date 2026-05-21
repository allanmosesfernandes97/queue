# Rung 1 — Synchronous

## The concept

HTTP request → server does work → HTTP response. The client waits with the connection open. This is the only pattern most people know and it works fine for fast work. The whole rest of this project is what to do when "fast" stops being true.

## What you build

- **One route handler** at `app/rung-1-sync/api/resize/route.ts` (POST). It accepts a file upload as `multipart/form-data`, calls sharp to resize, returns the resized JPEG bytes with `Content-Type: image/jpeg`.
- **One client page** at `app/rung-1-sync/page.tsx` with a file input + submit. Show the wall-clock seconds elapsed while you wait.

## Make the work feel slow

Real image resize on small files is fast. You need to *feel* the pain. In your route handler, `await` a `setTimeout` for ~8 seconds before doing the real sharp work. This simulates a CPU-heavy job (video transcode, AI inference, etc.).

## Pointers (don't copy, look up)

- Next.js App Router route handlers: `export async function POST(request: Request)`. Use `request.formData()` to get the file.
- sharp basics: `sharp(buffer).resize(W, H, { fit: "inside" }).jpeg().toBuffer()`.
- `export const runtime = "nodejs"` at the top of the route file — sharp needs Node, not Edge.

## Verify you've felt the pain

- [ ] Upload a 1–5MB image. Tab spins for ~8 seconds. No progress, no feedback, no cancel.
- [ ] Open a second tab and submit. Both stall — same Node process is busy.
- [ ] Submit, then close the tab during the wait. Server keeps doing the work for nobody. (Add a `console.log` at the end of the handler so you see it.)
- [ ] Note: in production behind Vercel / CloudFront, a 30s job dies at the edge before sharp finishes. That's a real bug, not a hypothetical.

## The lesson

HTTP request/response was not built to hold the connection for long work. Everything from here is variations on "send a receipt now, deliver the result later."
