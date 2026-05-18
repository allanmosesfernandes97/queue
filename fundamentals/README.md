# Fundamentals — staff-track refresh

Small, focused lessons on the JavaScript, TypeScript, and React building blocks that copy-paste-driven coding lets you skip. Each lesson is 15–25 minutes. They're sequenced — earlier ones underpin later ones.

## How to use

1. Read the **concept** at the top.
2. Cover the **answer key** at the bottom of the file and try the **predict-the-output** items in your head.
3. Open `fundamentals/scratch.ts` and write the **exercise**. Run it with `pnpm tsx fundamentals/scratch.ts`.
4. Compare to the answer key. If you got it without peeking — green. If not — re-read the concept and try again before moving on.

Don't bulk-binge. One lesson per sitting. The "oh" moment lands harder when you sleep on each one.

## The curriculum

| # | Lesson | What you lock in |
|---|---|---|
| 1 | [Functions are values](./01-functions-are-values.md) | Calling vs referencing. The parens are the call operator. |
| 2 | [Arrow function bodies](./02-arrow-functions.md) | Concise body returns automatically; block body needs `return`. |
| 3 | [Callbacks](./03-callbacks.md) | Passing functions as args. Pattern A (pass) vs Pattern B (wrap + call with args). |
| 4 | [Promises 101](./04-promises-basics.md) | A Promise is a write-once state machine for an eventual value. |
| 5 | [The Promise constructor](./05-promise-constructor.md) | `resolve` and `reject` are functions the constructor hands you. |
| 6 | [Wrapping callback APIs](./06-wrapping-callbacks.md) | Bridge old-style callbacks into the async/await world. |
| 7 | [async/await](./07-async-await.md) | Sugar over Promises. `return` = resolve, `throw` = reject. |
| 8 | [React events + async](./08-react-events-async.md) | `e.currentTarget` only lives during dispatch. Capture before `await`. |
| 9 | [TypeScript generics](./09-typescript-generics.md) | Angle brackets are placeholders for types, like parameters for functions. |

## When to come back

- After Rung 1 → do lessons 1–3
- After Rung 2 → do lessons 4–7 (Promises become unavoidable when you're managing job state)
- During Rung 3 → lesson 8 (you'll write event handlers with state updates)
- Anytime you read a typed library and squint at the `<>` → lesson 9

## Rule for yourself

Each lesson, you're allowed to feel dumb. You're not allowed to skip ahead. The lessons build — skipping is how you end up "kind of getting it" again, which is what you're trying to leave behind.
