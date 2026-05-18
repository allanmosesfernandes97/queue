# 7. async/await

`async`/`await` is **syntactic sugar over Promises**. Anything you can do with `async`/`await` you could do with `.then()` chains — but the sugar reads like sequential code.

## The two rules

**Rule 1:** an `async` function always returns a `Promise`. Even if its body just does `return 5`, you get `Promise<5>` outside.

```ts
async function five() { return 5 }
five()                  // → Promise that resolves with 5
await five()            // → 5
```

**Rule 2:** `await` only works inside an `async` function (or at the top level of an ES module).

## return = resolve, throw = reject

This is the mental model that makes everything click.

```ts
async function ok()    { return 42 }                    // → Promise.resolve(42)
async function bad()   { throw new Error('no') }        // → Promise.reject(new Error('no'))
```

Conversely, when you `await` a Promise:
- If it **fulfilled** → you get the value
- If it **rejected** → it throws (you catch with `try/catch`)

```ts
try {
  const v = await somePromise
  // promise fulfilled, v is the value
} catch (err) {
  // promise rejected, err is the rejection reason
}
```

## Why this matters

Compare:

```ts
// Without async/await — Promise chains
fetch('/api/x')
  .then(res => res.json())
  .then(data => doSomething(data))
  .catch(err => handleError(err))

// With async/await — reads top-down
try {
  const res = await fetch('/api/x')
  const data = await res.json()
  doSomething(data)
} catch (err) {
  handleError(err)
}
```

Same Promise machinery underneath. The `await` versions read like synchronous code, which is the whole point.

## Predict the output

```ts
async function go() {
  console.log('1')
  await Promise.resolve()
  console.log('2')
}

console.log('A')
go()
console.log('B')
```

What order?

## Exercise

In `scratch.ts`:

```ts
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// 1. Write an async function `ticker()` that:
//    - logs "tick 1"
//    - sleeps 500ms
//    - logs "tick 2"
//    - sleeps 500ms
//    - returns the string "done"
//
// 2. Call ticker() and log its return value.
//    Predict: what does the bare call console.log without await show?
//    Then await it and log again.
```

## Pitfalls

- **Forgetting `await`.** `const data = res.json()` (no await) gives you a `Promise<data>`, not the data. You'll log `Promise { <pending> }` and wonder why your code doesn't work.
- **Top-level await in non-modules.** Works in `.ts` files with `import`/`export` (modules). Doesn't work in plain script-y files. Adding `export {}` to a file makes it a module.
- **`forEach` doesn't await.** `array.forEach(async item => await thing(item))` runs all the things in parallel and doesn't wait for any. Use `for...of` with `await` if you want sequential, or `Promise.all(array.map(...))` if you want parallel-but-awaited.

---

## Answer key

- Predict: `A 1 B 2`. `go()` logs `1`, hits `await` (suspends, control returns to caller), `B` logs synchronously. The microtask queue then resumes `go`, logs `2`.
- Exercise: without `await`, `console.log(ticker())` prints something like `Promise { <pending> }` immediately, *before* the ticks. With `await`, you'd see `tick 1`, pause, `tick 2`, pause, then `done`.
