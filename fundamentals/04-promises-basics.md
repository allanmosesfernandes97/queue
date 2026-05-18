# 4. Promises 101

A **Promise** is a JS object that represents a value that will exist eventually — or an error if it goes wrong. Three states:

- **pending** — work hasn't finished
- **fulfilled** — work succeeded, has a value
- **rejected** — work failed, has an error

Once a Promise leaves `pending`, **it's locked**. You can't un-resolve or change the value.

```js
const p = Promise.resolve(42)        // fulfilled, value = 42
const q = Promise.reject(new Error('oops'))  // rejected
const r = new Promise(() => {})      // pending forever (never resolved)
```

## Three ways to read from a Promise

```js
await p                              // pauses async fn, returns the value
p.then(v => console.log(v))          // schedules a callback for when fulfilled
p.catch(err => console.log(err))     // schedules a callback for when rejected
```

`await` only works inside an `async` function (or at the top level of an ES module). `.then/.catch` work anywhere.

## The eager execution surprise

A Promise **starts doing its work immediately when constructed**, not when awaited. People assume Promises are lazy; they're not.

```js
console.log('A')
const p = new Promise(resolve => {
  console.log('B')               // fires NOW, during construction
  resolve('done')
})
console.log('C')
console.log(await p)             // 'done'
```

Order: `A B C done`.

## Predict the output

```js
async function run() {
  console.log('1')
  const p = Promise.resolve('hi')
  console.log('2')
  console.log(await p)
  console.log('3')
}
run()
console.log('4')
```

What order do `1`, `2`, `3`, `4`, `hi` print?

## Exercise

In `scratch.ts`:

```ts
async function main() {
  // 1. Create a fulfilled promise with the value 'Allan'.
  // 2. Log "before".
  // 3. await it and log the value.
  // 4. Log "after".
}
main()
```

Now change step 1 to `Promise.reject(new Error('no'))`. What happens? How do you handle it gracefully?

## Pitfalls

- **Forgetting `async`.** `await` only works inside `async` functions. Top-level `await` works in ES modules (any `.ts` file with `import`/`export`) but not in plain scripts.
- **Awaiting a non-Promise.** `await 5` is just `5`. No pause, no error. `await` only does something for actual Promises (technically, "thenables").
- **Assuming lazy execution.** The Promise's work begins the instant `new Promise(...)` runs. `await` just chooses *when to wait* for the already-running work.

---

## Answer key

- Predict: `1 2 4 hi 3`. `run()` starts. Logs `1`. Constructs `p` (fulfilled). Logs `2`. Hits `await p` — `run` suspends and `console.log('4')` runs. The microtask queue then resumes `run`, logs `hi`, then `3`.
- Exercise rejection handling: wrap the `await` in try/catch, or chain `.catch()` on the call to `main()`.
