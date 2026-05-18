# 1. Functions are values

In JavaScript, a function is a value just like `5` or `"hello"`. You can store it, pass it, return it. **Parentheses are the "call it now" operator** — without them, you're just referring to the function.

```js
const greet = () => 'hi'

greet      // the function itself (a value)
greet()    // calls it, returns 'hi'
```

## Predict the output

Cover the answer key and predict for each:

```js
const f = () => 5

console.log(f)          // A?
console.log(f())        // B?
console.log(typeof f)   // C?
console.log(f === f())  // D?

const g = f
console.log(g())        // E?
```

## Exercise

In `scratch.ts`:

1. Define `const add = (a: number, b: number) => a + b`.
2. Assign `add` to two more variables, `plus` and `combine`, **without calling it**.
3. Call all three with `(2, 3)` and log the results.
4. What does `typeof add` print? What does `typeof add(2, 3)` print?

## Pitfalls

- **Auto-import suggestions in VS Code** sometimes add useless imports for symbols you typed but didn't intend (e.g. `import { stat } from 'fs'`). Scan imports after autocomplete fires.
- **`setTimeout(f)` vs `setTimeout(f())`** — the second one calls `f` immediately and passes the return value to setTimeout. Always a bug. (You'll hit this hard in lesson 6.)

---

## Answer key

- A: prints the function definition, something like `[Function: f]`
- B: prints `5`
- C: `'function'`
- D: `false` (a function is not equal to its return value)
- E: `5` — `g` holds the same function reference as `f`
