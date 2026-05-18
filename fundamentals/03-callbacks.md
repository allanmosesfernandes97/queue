# 3. Callbacks

A **callback** is a function you pass to another function so the receiver can call it later. The receiver decides *when* and *with what arguments*.

```js
[1, 2, 3].map(n => n * 2)            // map calls (n => n*2) with each element
setTimeout(() => console.log('hi'), 1000)  // setTimeout calls () => console.log('hi') after 1s
button.addEventListener('click', handleClick) // browser calls handleClick(event) on click
```

## The three patterns

### Pattern A — pass the function reference

```js
button.addEventListener('click', handleClick)
```
"Here's the function. Call it when the click happens." The library decides what args to pass (typically the event).

### Pattern B — wrap to inject arguments

```js
button.addEventListener('click', () => deleteItem(id))
```
"Here's a wrapper. When you call it, *I'll* call `deleteItem` with the id I have in scope." Use when you need to pre-bake args.

### Pattern C — wrap and *forget* to call (always a bug)

```js
button.addEventListener('click', () => deleteItem)
```
When the click fires, the wrapper runs, evaluates `deleteItem` (gets the function reference), returns it, and the library throws the return value away. **Nothing happens.**

## Predict the output

```js
const shout = (msg) => console.log(msg.toUpperCase())

setTimeout(shout, 100)                  // A: what does setTimeout pass as arg?
setTimeout(() => shout('hi'), 200)      // B
setTimeout(shout('hi'), 300)            // C — careful, read it slowly
setTimeout(() => shout, 400)            // D
```

## Exercise

In `scratch.ts`:

```ts
const items = ['apple', 'banana', 'cherry']

// 1. Use .forEach with Pattern A — pass console.log directly
// 2. Use .forEach with Pattern B — pass an arrow that calls console.log
// 3. Use .map to return a new array of items in UPPERCASE
```

What's the difference between #1 and #2 in the output? Why?

## Pitfalls

- **Calling instead of passing.** `setTimeout(shout('hi'), 1000)` calls `shout('hi')` *right now* and passes its return value (`undefined`) to `setTimeout`. `setTimeout` sees `undefined`, has nothing to call after 1s. Almost always not what you want.
- **forEach / map gotcha with `console.log`.** `[1,2,3].forEach(console.log)` prints `1 0 […]` `2 1 […]` `3 2 […]` because `forEach` passes `(value, index, array)` to the callback. If you only want the value, wrap: `forEach(v => console.log(v))`.

---

## Answer key

- A: setTimeout calls `shout()` with no arguments → `msg` is `undefined` → `undefined.toUpperCase()` throws.
- B: After 200ms, prints `HI`.
- C: `shout('hi')` runs *immediately*, prints `HI`, returns `undefined`. setTimeout then schedules `undefined` (does nothing useful).
- D: After 400ms, the arrow runs, evaluates `shout` (gets the function), returns it. setTimeout throws it away. Nothing visible.
- Exercise: #1 logs each item plus its index and the array (forEach passes 3 args). #2 logs just the items.
