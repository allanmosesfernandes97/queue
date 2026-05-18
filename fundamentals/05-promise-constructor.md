# 5. The Promise constructor

The `new Promise(...)` form takes one argument: an **executor function**. The constructor calls your executor immediately, passing in two functions: `resolve` and `reject`.

```js
new Promise((resolve, reject) => {
  // The constructor gave us these two functions.
  // Call resolve(value) to fulfill.
  // Call reject(error) to reject.
  // Until one of them runs, the Promise stays pending.
})
```

## Mental model

Imagine the constructor roughly works like this:

```js
class Promise {
  constructor(executor) {
    let state = 'pending'
    let value

    const resolve = (v) => { if (state === 'pending') { state = 'fulfilled'; value = v } }
    const reject  = (e) => { if (state === 'pending') { state = 'rejected'; value = e } }

    executor(resolve, reject)
  }
}
```

`resolve` and `reject` are **handles into the Promise's state**. They're regular function values — you can pass them around, store them, hand them to other APIs as callbacks.

## Once it settles, it's locked

```js
const p = new Promise((resolve, reject) => {
  resolve('first')
  resolve('second')             // ignored
  reject(new Error('huh'))      // ignored
})
await p                         // → 'first'
```

The first resolve/reject wins. All later ones are silently dropped.

## Predict the output

```js
const p = new Promise((resolve) => {
  console.log('A')
  resolve('done')
  console.log('B')
})
console.log('C')
console.log(await p)
```

What prints, in what order?

## Exercise

In `scratch.ts`, write a function `flipCoin()` that returns a Promise:

- 50% chance: resolves with the string `'heads'`
- 50% chance: rejects with `new Error('tails')`

Then call it in a `try/catch` and log either the win or the loss.

Hint: use `Math.random() > 0.5`.

## Pitfalls

- **Forgetting parens on `resolve`/`reject`.** `resolve` (without parens) is the function reference — *naming* it, not calling it. To actually settle the Promise, you must invoke: `resolve(value)`.
- **Double-call confusion.** If you find yourself reasoning about "what if resolve runs twice" — usually means your async flow has a bug. Once-only is the contract.
- **Passing the executor function but not calling resolve.** A Promise whose executor never calls resolve/reject stays pending forever. Anything awaiting it hangs.

---

## Answer key

- Predict: `A B C done`. The executor runs synchronously: logs `A`, calls `resolve('done')` (flips state), logs `B`. Then `C` logs. Then `await p` unwraps the already-fulfilled value: `done`.
- Exercise: there are many right answers. The simplest:
  ```ts
  function flipCoin(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (Math.random() > 0.5) resolve('heads')
      else reject(new Error('tails'))
    })
  }
  ```
