# 2. Arrow function bodies

Arrow functions have two forms. They look almost the same but mean different things:

**Concise body** — the expression after `=>` is automatically returned.
```js
const f = () => 42
// equivalent to:
const f = () => { return 42 }
```

**Block body** — curly braces. You need an explicit `return`. No `return` = returns `undefined`.
```js
const f = () => {
  42         // just evaluated and discarded
}            // returns undefined
```

The trap: **a concise body returns whatever follows the arrow, even if you didn't want it returned.**

## Predict the output

```js
const a = () => 5
const b = () => { 5 }
const c = () => { return 5 }
const d = () => alert
const e = () => alert()

console.log(a())          // A?
console.log(b())          // B?
console.log(c())          // C?
console.log(d())          // D?  (don't actually run e — it pops an alert)
```

## Exercise

In `scratch.ts`, write three versions of a function `double` that takes a number and returns it × 2:

1. `doubleA` — concise body, one line
2. `doubleB` — block body with explicit `return`
3. `doubleC` — block body **without** `return` (intentionally broken)

Call all three with `5`. Predict the outputs, then run and check.

## Pitfalls

- The bug `onClick={() => formSubmit}` from this session's React work was a **block-body intent** smuggled into a **concise-body form**. The concise body evaluated `formSubmit` (got the function reference), returned it, and React threw it away. Always ask: "is this body returning what I think it is?"
- Concise body with an **object literal**: `() => { foo: 1 }` doesn't return `{foo: 1}` — the curlies are parsed as a block, and `foo: 1` is a label-statement followed by `1`. To return an object literal concisely, wrap in parens: `() => ({ foo: 1 })`.

---

## Answer key

- A: `5` — concise body returns the expression
- B: `undefined` — block body, no `return`
- C: `5` — block body with `return`
- D: prints the `alert` function reference (whatever the runtime's display of it is)
- E (not run): would call `alert()` and return its result (`undefined`)
