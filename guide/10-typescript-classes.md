# Classes in TypeScript — the whole picture

> Study note. Spawned from `lib/redis.ts`, where `IORedis` is a class you both call
> (`new IORedis(...)`) and use as a type. This covers classes end to end: what they are,
> every piece of syntax, the TS-specific extras, inheritance, and *when you'd actually
> reach for one* (vs. the plain-function style this codebase mostly uses).
> Pairs with [09 — value vs type space](09-typescript-value-vs-type-space.md).

---

## 1. What a class actually is

A **class is a blueprint for objects.** It bundles together:
- **state** (data — called *fields* or *properties*), and
- **behavior** (functions that operate on that state — called *methods*),

so you can stamp out many objects that share the same shape and abilities.

```ts
class Counter {
  count = 0;                 // field (state)
  increment() { this.count++; }   // method (behavior)
}

const a = new Counter();     // an INSTANCE — its own count
const b = new Counter();     // a different instance — its own count
a.increment();
console.log(a.count, b.count); // 1 0   ← independent state
```

- **Class** = the blueprint (`Counter`).
- **Instance** = one object built from it (`a`, `b`), created with **`new`**.
- Each instance has its **own copy of the fields**, but **shares the methods** (methods live on the prototype, not copied per instance).

`ioredis` is the same idea: `IORedis` is the blueprint, `new IORedis(url)` is one live connection instance with its own socket.

---

## 2. `new`, the constructor, and `this`

**`new`** does four things: creates a fresh empty object, links it to the class's prototype, runs the **constructor** with `this` bound to that new object, and returns it.

The **constructor** is the special method that runs once at creation — use it to set up initial state from arguments:

```ts
class Connection {
  url: string;
  constructor(url: string) {
    this.url = url;          // `this` = the instance being built
  }
}
const c = new Connection('redis://localhost:6379');
c.url; // "redis://localhost:6379"
```

**`this`** inside a method = "the instance the method was called on." This is the gotcha of classes: if you detach a method (`const f = c.someMethod; f()`), `this` is lost. (Arrow-function fields or `.bind` fix it — a footnote, not worth dwelling on now.)

---

## 3. Fields, methods, getters/setters

```ts
class Job {
  id: string;                  // field, typed
  progress = 0;                // field with default (type inferred as number)
  private result?: string;     // optional + private (see §4)

  constructor(id: string) { this.id = id; }

  setProgress(p: number) {     // method
    this.progress = p;
  }

  get isDone() {               // GETTER — accessed like a property: job.isDone
    return this.progress === 100;
  }
  set output(value: string) {  // SETTER — assigned like a property: job.output = "..."
    this.result = value;
  }
}
```

- **Getters/setters** let a *method* masquerade as a *property* — `job.isDone` (no parens) runs the getter. Good for derived/computed values.

---

## 4. TS-only extras (these don't exist in plain JS the same way)

### Access modifiers — who can touch a member
| Modifier | Reachable from… |
|---|---|
| `public` (default) | anywhere |
| `private` | only inside this class |
| `protected` | this class **and** subclasses |
| `readonly` | can be set once (in constructor), never reassigned |

```ts
class Account {
  public name: string;
  private balance: number;       // hidden from outside code
  protected id: string;          // subclasses can see it
  readonly createdAt: number;    // set once, then frozen
}
```
> Note: `private`/`protected` are **compile-time only** — TypeScript erases them, so they're not truly hidden at runtime. (JS's *real* private uses `#field` syntax.) For app code, the TS version is plenty.

### Parameter properties — the big shorthand
Declaring a field *and* assigning it in the constructor is so common TS gives you a one-liner. Put a modifier on a constructor parameter and TS auto-creates + assigns the field:

```ts
// verbose
class A {
  private url: string;
  constructor(url: string) { this.url = url; }
}

// identical, shorthand — TS makes `this.url` for you
class B {
  constructor(private url: string) {}
}
```
You'll see this constantly in real TS codebases. `private`, `public`, `readonly` all work as the prefix.

---

## 5. `static` — members on the class, not the instance

`static` members belong to the **class itself**, not to instances. Use for factory methods, constants, or things that don't need per-instance state.

```ts
class Temperature {
  static readonly ABSOLUTE_ZERO = -273.15;   // shared constant
  constructor(public celsius: number) {}

  static fromFahrenheit(f: number) {          // factory: builds an instance
    return new Temperature((f - 32) * 5 / 9);
  }
}

Temperature.ABSOLUTE_ZERO;            // accessed on the CLASS
const t = Temperature.fromFahrenheit(212);   // → 100°C
```

Rule of thumb: **instance member** = "needs `this`/per-object data." **static member** = "belongs to the concept, not a specific object."

---

## 6. Inheritance — `extends` and `super`

A class can build on another, inheriting its fields/methods and adding or overriding.

```ts
class Animal {
  constructor(public name: string) {}
  speak() { return `${this.name} makes a sound`; }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);            // MUST call super() before using `this` in a subclass
  }
  override speak() {        // override the parent method
    return `${this.name} barks`;
  }
}

const d = new Dog('Rex', 'Lab');
d.speak();  // "Rex barks"
d.name;     // "Rex"  ← inherited
```

- **`extends`** — "is a kind of," inherits everything.
- **`super(...)`** — calls the parent constructor; required in a subclass constructor before touching `this`.
- **`super.method()`** — call the parent's version of a method.
- **`override`** — TS keyword that documents (and verifies) you're intentionally replacing a parent method.

> Caution: deep inheritance chains get fragile fast. Most modern code favors **composition** (objects holding other objects) over tall inheritance trees. Inheritance shines for genuine "is-a" hierarchies and framework base classes.

---

## 7. `abstract` classes

A **blueprint that can't be instantiated directly** — it defines a contract for subclasses, optionally with shared implementation.

```ts
abstract class Shape {
  abstract area(): number;          // no body — subclasses MUST implement
  describe() { return `Area is ${this.area()}`; }  // shared concrete method
}

class Circle extends Shape {
  constructor(private r: number) { super(); }
  area() { return Math.PI * this.r ** 2; }   // required
}

new Shape();   // ❌ error — abstract, can't instantiate
new Circle(2); // ✅
```

Use when you have shared behavior *plus* holes each subclass must fill.

---

## 8. `implements` — classes and interfaces together

An **interface** is a pure type-space contract (no runtime code). A class can promise to satisfy one with `implements`:

```ts
interface Logger {
  log(msg: string): void;
}

class ConsoleLogger implements Logger {
  log(msg: string) { console.log(msg); }   // must match the interface
}
```

- `extends` (class→class) = inherit real implementation.
- `implements` (class→interface) = "I promise to have this shape," but you write the code yourself.

---

## 9. The value/type duality (the bit you already met)

Because a `class` declaration lives in **both** value space and type space (see note 09):

```ts
class Job { id = ''; }

const j: Job = new Job();   // Job-as-TYPE (annotation) + Job-as-VALUE (constructor)
```

Two extra moves you'll see:
- **`typeof MyClass`** = the *type of the constructor itself* (the static side) — e.g. for "pass me the class, not an instance."
- **`InstanceType<typeof MyClass>`** = the instance type (usually just `MyClass`, but needed in generic factory code).

---

## 10. When to actually use a class (vs. this codebase's style)

Important, because **rung-3 deliberately did NOT use classes** — it used plain functions (`enqueue`, `getJob`) over module-level state stashed on `globalThis`. That's a legitimate, often-preferred style in modern TS/JS.

**Reach for a class when:**
- You need **many independent instances**, each with its own state (a `Counter`, a DB `Connection`, a `Worker`). ← this is the strongest signal
- A library hands you one and expects `new` (`IORedis`, BullMQ's `Queue`/`Worker`).
- State and the behavior over it are tightly bound and you want them packaged together.

**Prefer plain functions + objects when:**
- There's effectively **one** of the thing (a singleton — like your queue module). A module already *is* a singleton; a class adds ceremony for nothing.
- You're doing data-in → data-out transformations.
- You want simpler testing and less `this`-juggling.

> So in rung-4 you'll *consume* classes (`new Queue(...)`, `new Worker(...)`) because the library is built that way — but your own glue code can stay in the plain-function style you already know. Using `new IORedis()` doesn't mean *you* must write classes.

---

## One-screen cheat sheet

```ts
class Foo extends Bar implements Baz {
  static SHARED = 1;            // on the class, not instances
  readonly id: string;          // set once
  private secret = 0;           // class-internal only

  constructor(public name: string, id: string) {  // `public name` = parameter property
    super();                    // call parent ctor first
    this.id = id;
  }

  get label() { return this.name; }   // computed property
  method() { return this.secret; }    // shares `this`
  override fromBar() {}               // intentionally replaces Bar's
}

const f = new Foo('x', '1');   // Foo as VALUE (constructor)
let g: Foo;                    // Foo as TYPE (instance shape)
```

| Concept | Keyword | One-liner |
|---|---|---|
| make instance | `new` | runs constructor, returns object |
| init state | `constructor` | runs once at creation |
| current instance | `this` | the object a method was called on |
| field shorthand | `public/private x` in ctor | auto-declares + assigns |
| class-level member | `static` | belongs to the class, not instances |
| inherit | `extends` + `super` | build on another class |
| can't instantiate | `abstract` | contract + shared code for subclasses |
| satisfy a contract | `implements` | match an interface's shape |
| hide member | `private` / `#` | TS-only vs. real-JS-private |
