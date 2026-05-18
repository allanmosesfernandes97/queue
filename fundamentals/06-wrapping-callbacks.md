# 6. Wrapping callback APIs

A lot of legacy / built-in JS APIs use **callbacks**, not Promises. To use them inside `async`/`await`, you wrap them in a `new Promise`. The wrapper says: "call resolve when the callback fires successfully, call reject if it errors."

## The canonical example — `setTimeout`

```js
await new Promise(resolve => setTimeout(resolve, 1000))   // pauses 1s
```

Read it: "make a new Promise; pass `resolve` to `setTimeout` as the callback so the timer fires it after 1000ms; await the Promise."

The crucial detail: `setTimeout(resolve, 1000)` passes the `resolve` **reference** to setTimeout. When the timer fires, setTimeout calls `resolve()` with no arguments → Promise fulfills with `undefined` → `await` unblocks.

## Making it reusable

```ts
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// usage
await sleep(8000)
```

You'll write this utility in basically every project.

## The general shape

For any callback-based API:

```ts
function wrappedThing(args): Promise<Result> {
  return new Promise((resolve, reject) => {
    callbackBasedAPI(args, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}
```

Node's older APIs use the `(err, result)` callback convention — `err` is null on success, an Error otherwise. Modern Node ships Promise versions (`fs.promises.readFile`, `node:timers/promises`) so you usually don't have to write the wrapper, but the pattern is universal.

## Predict the output

Three versions of the sleep call. Which one actually pauses?

```ts
// A
await new Promise(resolve => setTimeout(resolve, 1000))

// B
await new Promise(resolve => setTimeout(() => resolve(), 1000))

// C
await new Promise(resolve => setTimeout(() => resolve, 1000))
```

## Exercise

In `scratch.ts`:

```ts
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  console.log('A', Date.now())
  await sleep(2000)
  console.log('B', Date.now())
  await sleep(1000)
  console.log('C', Date.now())
}
main()
```

Run it. Confirm the timestamps differ by ~2000 and ~1000 ms. Now break it on purpose: change `resolve` to `() => resolve` in the wrapper. Run again. What happens? Why?

## Pitfalls

- **Forgetting parens (again).** `() => resolve` returns the function value and discards it. The Promise never fulfills. Your code hangs forever — easy to mistake for "slow network" until you look at the wrapper.
- **Double-resolving from error handlers.** Some callback APIs fire success then later fire error. If your wrapper calls `resolve` then `reject`, the second is ignored — but it's a sign your wrapper isn't modeling the underlying API correctly.

---

## Answer key

- A: pauses 1s. `setTimeout(resolve, 1000)` — timer fires `resolve()` after 1s.
- B: pauses 1s. Wraps and calls — also works.
- C: **hangs forever.** The inner arrow returns `resolve` and discards it. The Promise never fulfills. (This is the bug you wrote earlier in this session — same shape.)
