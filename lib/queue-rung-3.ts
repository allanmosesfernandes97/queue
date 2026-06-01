import { sleep } from '@/utils/lib';
import sharp from 'sharp';

// queue + worker logic
export type JobState = {
    id: string;
    status: 'pending' | 'processing' | 'done' | 'failed';
    progress: number;
    resultDataUrl?: string;
    error?: string;
};

type PendingJob = {
    id: string;
    input: Buffer;
};

type GlobalState = {
    __jobStore?: Map<string, JobState>;
    __pendingJobs?: PendingJob[];
    __active?: number;
};

export type Stats = {
    pending: number;
    active: number;
    concurrency: number;
};

const CONCURRENCY = 2;

// HMR fix
const g = globalThis as unknown as GlobalState;
const jobs = g.__jobStore ?? new Map<string, JobState>();
const pendingJobs = g.__pendingJobs ?? []; // Queue of waiting work
let active = g.__active ?? 0; // Counter - how many jobs are running

g.__jobStore = jobs;
g.__active = active;
g.__pendingJobs = pendingJobs;

export function getJob(id: string): JobState | undefined {
    return jobs.get(id);
}

export function stats(): Stats {
    return {
        pending: pendingJobs.length,
        active,
        concurrency: CONCURRENCY,
    };
}

// Modifiers for mutating map
function markProcessing(id: string, progress: number): void {
    const job = getJob(id);
    if (!job) return;
    job.progress = progress;
    job.status = 'processing';
}

function markDone(id: string, resultDataUrl: string): void {
    const job = getJob(id);
    if (!job) return;
    job.resultDataUrl = resultDataUrl;
    job.progress = 100;
    job.status = 'done';
}

function markFailed(id: string, error: string): void {
    const job = getJob(id);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
}

// Image processing
async function imageProcessing(id: string, inputBytes: Buffer) {
    try {
        // 1. Fake progress & mark progress
        for (let p = 10; p < 90; p += 10) {
            await sleep(800);
            markProcessing(id, p);
        }
        // 2. Process the image
        const outputBytes = await sharp(inputBytes)
            .resize(800, 800, { fit: 'inside' })
            .jpeg()
            .toBuffer();

        // Encode to dataURL
        const resultDataUrl = `data:image/jpeg;base64,${outputBytes.toString('base64')}`;
        // Dispatch
        markDone(id, resultDataUrl);
    } catch (err) {
        markFailed(id, err instanceof Error ? err.message : String(err));
    }
}

// Dispatcher server side
// See if there's anything I can start right now, start whatever fits, then go away
/*
    TWO Questions it always asks:
    1. Do I have room to start more work (ACTIVE < CONCURRENCY)
    2. Is there work waiting (pendingJobs.length > 0)
    IF YES TO BOTH: start one -> Then ask again -> Then again.
    Until one of the answers is no, and stop.
    Thats the whole function

    Dispatch doesn't need to know about any specific id. Its whole job is to look at the queue and the active counter and decide what to start. It's stateless — anyone can call it with no arguments. Change the signature to function dispatch() {.

    If you ever found yourself passing an id into the dispatcher, that'd be a hint you're confusing "dispatcher's job" 
    (start whatever's waiting) with "worker's job" (run this specific job).
*/
/**First: drop the id parameter from dispatch

function dispatch(id: string) {
dispatch doesn't need to know about any specific id. Its whole job is to look at the queue and the active counter and decide what to start. It's stateless — anyone can call it with no arguments. Change the signature to function dispatch() {.

If you ever found yourself passing an id into the dispatcher, that'd be a hint you're confusing "dispatcher's job" (start whatever's waiting) with "worker's job" (run this specific job).

Now the body of the while loop — 5 steps
Inside the while, you need to do 5 things in this order. Try to write each one yourself; I'll describe what each step accomplishes and what JS feature you need.

Step 1: Take the next job from the front of pendingJobs
You need to remove the first element of the array AND get its value in one move. There's an Array method that does exactly this — it modifies the array (shortens it by one) and returns the element it removed.

Hint: it's the opposite of push (which adds to the end). Think about queue terminology — FIFO. First In, First Out.

The variable to store the result in: something like const job = ....

You may also need a TS hint at the end (an exclamation mark) because TS thinks the method might return undefined — even though you know it won't, because the while condition guarantees the array is non-empty.

Step 2: Claim the slot
You need to increment active by 1. Simple — there's a unary operator for this.

But here's the subtle thing: increment synchronously and immediately, BEFORE you fire off any work. Why? If you incremented after the work started, two near-simultaneous calls could both start jobs before either incremented, blowing past your concurrency cap.

Step 3: Persist active to globalThis
After incrementing, copy the new value to g.__active so HMR-reloaded code sees the right number. One line:


g.__active = active
Skip this and dev-mode HMR will desync your counter. Two assignments per state change is the cost.

Step 4: Fire-and-forget the actual work
Call imageProcessing(job.id, job.input). Do not await it. The return value is a Promise that will eventually resolve when the work finishes. You're not waiting on it — the next iteration of the while needs to continue immediately so it can maybe start another job.

But you DO need to attach a callback for when the Promise eventually resolves. That's Step 5.

Step 5: Schedule cleanup for when the work finishes
On the Promise from Step 4, attach a callback that runs when the Promise settles (succeeds OR fails). The method that runs on both success and failure has a specific name — it's not .then() and not .catch(). It's the one that says "after all is said and done, run this."

Inside that callback, you need to:

Decrement active (release the slot)
Persist the new active to g.__active
Call dispatch() again — to see if there's a pending job waiting for the slot you just freed
So the shape is something like:


imageProcessing(...).<callback-method>(() => {
  active--
  g.__active = active
  dispatch()
})
Replace <callback-method> with the right method name. Remember: runs on success OR failure.

What the whole loop body looks like (verbally)

take the next pending job
claim a slot (increment + persist)
start the work (no await)
on completion, no matter what: release slot, persist, dispatch again
5 small statements. The first 3 are linear. The 4th and 5th are tied together by the Promise callback chain.

Why each step matters
Step 1 (take job): moves a unit of work from "waiting" to "about to run." Must be synchronous and atomic — no other JS can run between checking length and removing the first element, so there's no race condition. (JavaScript's single-threaded nature is helping you here.)
Step 2 (claim slot): locks the seat at the table. Before fire-and-forget so the counter is correct even under quick successive dispatch() calls.
Step 3 (persist): HMR hygiene. Skip if you don't care about dev-mode correctness.
Step 4 (fire): the actual work starts. Note: this isn't blocking — the Promise is hot the moment it's constructed. The work begins immediately and runs in the background.
Step 5 (callback): the "self-driving" mechanism. Every completion triggers another dispatch(), which checks the queue and starts the next job if possible. This is what makes the system run forever as long as there's work, without anyone explicitly looping.
What you should NOT do
❌ await imageProcessing(...) inside the loop — would block the loop from starting other jobs. The whole point is to fire it and immediately move on.
❌ .then() instead of the success-OR-failure callback — if imageProcessing throws (it can't here, because of its try/catch, but in principle), .then() wouldn't fire and your active counter would never decrement. The slot would be permanently held.
❌ Pass id into dispatch() — it doesn't need one. It looks at the queue itself.
❌ Forget to call dispatch() inside the callback — without it, the system stops dispatching after the first batch finishes.
The hint for "method runs on success OR failure"
If you're stuck on Step 5's method name: think about what comes after try/catch. There's a block that runs whether or not an exception was caught. Promises have the same concept, exposed as a method. Three letters more than final.

Try writing it now
Write the 5-line body. When you're done, ping me and I'll review — there are a few subtle things to double-check (the !, the order of operations, the method name). Don't peek at code online — the lesson is in writing this 7-line dispatcher by hand. Once you've written one, you'll see it everywhere in production systems.
 *
 *
 */
function dispatch() {
    while (active < CONCURRENCY && pendingJobs.length > 0) {
        // 1. Take the next job from the front of pending jobs
        const currentJob = pendingJobs.shift()!;
        // 2. Increment active by 1
        active++;
        //3.
        g.__active = active;
        imageProcessing(currentJob.id, currentJob.input).finally(() => {
            active--;
            g.__active = active;
            dispatch();
        });
    }
}

export function enqueue(id: string, input: Buffer) {
    const newJob: JobState = {
        id,
        status: 'pending',
        progress: 0,
    };

    jobs.set(id, newJob);
    pendingJobs.push({ id, input });
    dispatch();
}

// SERVER (Next.js Node process)
/*
    POST /api/jobs:
    enqueue(id, bytes)
        -adds to pending jobs
        - calls dispatcher


    DISPATCHER
        while(room && work pending) {
            start next job (fire-and-forget)
            when job finishes call me again
        }
*/
