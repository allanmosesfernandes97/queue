# 8. React events + async handlers

A React event handler that does async work is one of the highest-bug-density patterns in the React universe. The single rule that prevents 90% of these bugs:

**Read everything you need from `event` synchronously, before any `await`.**

## Why — the `currentTarget` story

When an event fires, the browser dispatches it through the DOM, setting `event.currentTarget` to whichever element's handler is currently running. **Once dispatch finishes**, the browser nulls out `currentTarget` because the concept ("currently dispatching") no longer applies.

Your async handler's first `await` returns control to the browser. Dispatch finishes. `currentTarget` becomes `null`. When your code resumes after `await`, it's gone.

```ts
const onSubmit = async (e) => {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)   // ✓ sync — works
  await fetch('/api/x', { body: fd })        // ← dispatch ends here
  e.currentTarget.reset()                    // 💥 null.reset() — TypeError
}
```

## The fix — capture before await

```ts
const onSubmit = async (e) => {
  e.preventDefault()
  const form = e.currentTarget               // capture synchronously
  const fd = new FormData(form)
  await fetch('/api/x', { body: fd })
  form.reset()                                // use the captured reference
}
```

`form` is a plain JS variable — it survives any number of awaits.

## What's safe across an await on `e`?

- `e.target` — the original target node reference. Survives.
- `e.preventDefault()` / `e.stopPropagation()` — already happened synchronously, no issue.
- `e.currentTarget` — **dies** after dispatch ends.
- Input values: `e.target.value` is fine to read after, but the *DOM input's current value* might have changed if the user typed more — capture if you want a snapshot.

When in doubt: capture.

## Predict — which break?

```tsx
// A
<form onSubmit={async (e) => {
  await save()
  e.preventDefault()
}}>

// B
<form onSubmit={async (e) => {
  e.preventDefault()
  await save()
  console.log(e.target)
}}>

// C
<form onSubmit={async (e) => {
  e.preventDefault()
  await save()
  e.currentTarget.reset()
}}>

// D
<form onSubmit={async (e) => {
  e.preventDefault()
  const form = e.currentTarget
  await save()
  form.reset()
}}>
```

Which of A, B, C, D works correctly?

## Exercise

Open `app/rung-1-sync/page.tsx`. If you haven't already, refactor `formSubmit` to capture the form element synchronously before any await. Make sure `form.reset()` only runs on the success path.

## Pitfalls

- **`e.preventDefault()` after `await`.** The browser's default behavior already kicked in milliseconds ago — calling it later has no effect. Always call it as the **first line** of the handler.
- **Reading input values after await for "current value".** The user might have typed more characters. If you need the snapshot at submit time, capture into a local variable up front.
- **Relying on `e.target.value` for select/file inputs.** For some elements, properties get reset by the browser as the event finishes. Snapshot up front.

---

## Answer key

- A: **broken** — `preventDefault` happens too late, the form has already submitted (page reloads).
- B: works — `e.target` is the original target, survives across `await`. (Though watching for the captured-reference style is still safer.)
- C: **broken** at `e.currentTarget.reset()` — `currentTarget` is null after the await.
- D: works — captured reference is rock-solid.
