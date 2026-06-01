# TypeScript — Value Space vs Type Space (a class is both)

> Came up while writing `lib/redis.ts`: how can `IORedis` be *called* (`new IORedis(...)`)
> **and** used as a *type* (`__redis?: IORedis`) when it's "just a library"? This note explains
> the rule behind it. Worth re-reading until it's automatic — it explains a lot of TS confusion.

---

## The core idea: TypeScript has two separate "namespaces"

Every name in TypeScript lives in one or both of two independent worlds:

- **Value space** — things that exist at **runtime**. Variables, functions, the constructor you call with `new`. This is real JavaScript; it survives compilation.
- **Type space** — things that exist **only at compile time**. Type annotations, interfaces, generics. All of it is **erased** before the code runs — the JS engine never sees it.

The same identifier can mean *different things* depending on which world you're in. Where the name appears decides which space TypeScript looks in:

```ts
const x: Foo = makeFoo();
//    │  └── TYPE space   (after the colon → "what shape is this?")
//    └───── VALUE space  (the actual runtime variable)
```

After a `:` (annotations), in `implements`/`extends` type positions, inside `<...>` generics → **type space**.
Everywhere else (calling, `new`, passing as an argument, returning) → **value space**.

---

## Why a class is special: it creates BOTH

Most declarations only populate **one** space:

| Declaration | Value space (runtime)? | Type space (compile-time)? |
|---|:---:|:---:|
| `const` / `let` / `var` | ✅ | ❌ |
| `function` | ✅ | ❌ |
| `interface` | ❌ | ✅ |
| `type` | ❌ | ✅ |
| **`class`** | ✅ | ✅ |
| `enum` | ✅ | ✅ |

A **`class` declaration emits two things under one name**:

1. **A value** — the constructor function. Real JS, callable with `new`. → `new IORedis(url, opts)`
2. **A type** — the *instance type*: "an object produced by `new ThisClass(...)`." → `__redis?: IORedis`

That's why this works with one import:

```ts
import IORedis from 'ioredis';

new IORedis(url, opts)   // VALUE position — calling the constructor (runtime)
let conn: IORedis        // TYPE position  — "an instance of it" (compile-time only)
```

No contradiction with "it's just a library." The library ships its behavior **as a class**, and a class automatically hands you the instance-type for free. You're not *defining* a type — you're *borrowing* the one the class already comes with.

---

## Proof it's two separate spaces

You can have a **type and a value with the same name that are completely unrelated** — because they live in different namespaces and never collide:

```ts
type Color = 'red' | 'green';      // lives in TYPE space
const Color = { red: '#f00' };     // lives in VALUE space — totally fine, no clash

const a: Color = 'red';            // TS reads TYPE space here
const b = Color.red;               // TS reads VALUE space here
```

This is also why you **can't** use a type where a value is needed, or vice versa:

```ts
interface Animal { legs: number }
const x = Animal;        // ❌ "Animal only refers to a type, but is being used as a value"

function enqueue() {}
let y: enqueue;          // ❌ "enqueue refers to a value, but is being used as a type"
```

`interface` is type-only → invisible at runtime. `function` is value-only → invisible to the type checker. A **class** is the thing that bridges both, which is exactly why `IORedis` works in both spots.

---

## The bridge operators (how to cross between spaces)

When you DO need to move from one space to the other, TS gives you two operators:

**`typeof` (in a type position)** — "give me the *type* of this *value*":
```ts
const settings = { retries: 3, url: 'redis://...' };
type Settings = typeof settings;   // { retries: number; url: string }
```
Useful when you have a value (like a config object) and want its shape as a type without rewriting it.

**Indexed access / instance type tricks** — e.g. `InstanceType<typeof SomeClass>` gets the instance type from a class value. (You rarely need this for classes since the class name *already* is the instance type — but handy for factory functions.)

---

## Mental rules to walk away with

1. **`class` → constructor (value) + instance-type (type), both under one name.** That's the whole reason `IORedis` works in both positions.
2. **`interface` / `type` are type-only** → erased at runtime, can't be `new`-ed or referenced as values.
3. **`const` / `function` are value-only** → can't be used after a `:`.
4. **Position decides the space:** after `:`, in `<...>`, in `extends`/`implements` type slots → type space. Everywhere else → value space.
5. **Types are erased.** If it only ever appears in type space, it contributes *zero* bytes to the running JS. (This is why importing a type costs nothing.)

---

## Tie-back to the code

```ts
import IORedis from 'ioredis';

type GlobalRedis = { __redis?: IORedis };   // IORedis used as a TYPE (instance shape)
const g = globalThis as unknown as GlobalRedis;

export const redis =
  g.__redis ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
//             └── IORedis used as a VALUE (constructor call)
g.__redis = redis;
```

Same import, two jobs — and now you know exactly why that's allowed.
