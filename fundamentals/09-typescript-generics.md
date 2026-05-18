# 9. TypeScript generics

A generic is **a type with a placeholder**. The angle brackets `<>` are how you fill the placeholder in, the same way parens fill in function arguments.

```ts
function double(n: number) { return n * 2 }   // function param
type Box<T> = { value: T }                     // type param
```

Then you fill in:

```ts
double(5)                  // call with value 5
const b: Box<string> = { value: 'hi' }   // type Box with T = string
```

## Where you see them in the wild

```ts
Array<string>                            // an Array of strings
Promise<User>                            // a Promise resolving to User
Map<string, number>                      // Map from string keys to number values
useState<boolean>(false)                 // state holding a boolean
React.MouseEvent<HTMLButtonElement>      // mouse event on a button element
Record<string, User>                     // object: string keys → User values
```

Same shape every time. What's in `<>` is filling in a type placeholder declared by the library author.

## Why bother?

Without generics, libraries would either lose type information or need a separate type per use case:

```ts
// Without generics — useless
function first(arr: any[]): any { return arr[0] }

const n = first([1, 2, 3])      // n is `any` — TS lost the info
n.toUpperCase()                  // compiles, then crashes at runtime
```

```ts
// With generics — type info flows through
function first<T>(arr: T[]): T | undefined { return arr[0] }

const n = first([1, 2, 3])      // n is `number | undefined`
n.toUpperCase()                  // ✗ TS error: number has no toUpperCase
```

The function works for *any* element type, and TS knows which one you're using at each call site.

## React event types use generics for the element

```ts
React.SubmitEvent<HTMLFormElement>     // submit event where currentTarget is a form
React.ChangeEvent<HTMLInputElement>    // change event where currentTarget is an input
React.MouseEvent<HTMLButtonElement>    // mouse event where currentTarget is a button
```

The `<element>` is what `e.currentTarget` is typed as. Without it, you get the generic `Element` (the DOM base class), which has none of the form-specific properties — `e.currentTarget.elements` won't compile.

## Predict

```ts
function identity<T>(x: T): T { return x }

const a = identity('hello')      // A: type of a?
const b = identity(42)           // B: type of b?
const c = identity<number>(42)   // C: type of c?
const d = identity<number>('hi') // D: does this compile?
```

## Exercise

In `scratch.ts`:

```ts
// 1. Write a generic function `last<T>(arr: T[]): T | undefined`
//    that returns the last element of an array.

// 2. Call it with arrays of numbers, strings, and a mixed array.
//    Verify TS infers the right return type at each call site.

// 3. Write a generic function `pair<A, B>(a: A, b: B): [A, B]`
//    that returns the two arguments as a tuple.
//    Call it with (1, 'hi'). What does TS say the type is?
```

## Pitfalls

- **Confusing "the type parameter" with "the value's type".** `useState<string>(0)` — TS catches the mismatch because the value `0` doesn't fit the `string` placeholder you provided.
- **Letting inference do its job.** You usually don't need to explicitly fill in generics. `identity(42)` infers `T = number` from the argument. Annotate only when inference can't figure it out or when you want to constrain it.
- **`as Foo` is not the same as generics.** `as` is a cast (a TS-only lie). Generics are real type information that propagates. Prefer generics + inference over casts where possible.

---

## Answer key

- A: `string`
- B: `number`
- C: `number`
- D: ✗ Does **not** compile. You said `T = number`, but `'hi'` is a string.
- Exercise: `last([1,2,3])` → `number | undefined`. `pair(1, 'hi')` → `[number, string]`.
