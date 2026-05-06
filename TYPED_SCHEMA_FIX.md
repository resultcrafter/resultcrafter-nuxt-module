# Typed Schema Plugin

> **Branch:** `feat/typed-schema-plugin` (based on `feat/upstream-package-refresh-and-sdk-v21`)

## The Problem (In Plain English)

Imagine you have a restaurant menu in a language you don't speak. You can see there are dishes, but you can't tell what any of them are. That's what was happening with TypeScript and Directus.

The nuxtus module creates a `$directus` client that talks to your Directus database. When you write code like:

```typescript
const posts = await $directus.request($readItems('blogposts', { ... }))
```

TypeScript needs to know: "What does a blogpost look like? What fields does it have?"

Before this fix, the answer was: **"I have no idea"** — technically `Record<string, never>`. TypeScript treated every collection as if it had zero fields. So when you tried to access `post.title`, TypeScript said "title doesn't exist" — not because the field was missing, but because it thought *every* field was missing.

This caused ~40+ red squiggly errors across the codebase, even though the code worked perfectly at runtime.

## The Fix (Three Pieces)

### 1. Changed the Default Schema from "Nothing" to "Anything"

**File:** `src/runtime/plugin.ts` (line 19)

```diff
- type Schema = Record<string, never>;
+ type Schema = Record<string, any>;
```

**What this means:** Instead of "this object has no fields" (`never`), we say "this object can have any fields" (`any`). Apps that don't configure types get zero errors — everything resolves to `any`, which is like telling TypeScript "trust me, it exists."

### 2. Added a `schemaPath` Option for Full Typing

**File:** `src/module.ts`

Apps can now opt into full type safety by telling the module where their schema types live:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    ['@nuxtus/nuxt-module', { schemaPath: 'interfaces/directus-schema.ts' }]
  ]
})
```

When `schemaPath` is set, the module **generates a TypeScript augmentation file** (`.nuxt/nuxtus-schema-augmentation.d.ts`) that tells TypeScript exactly what `$directus`, `$readItems`, etc. look like with your specific collections.

Think of it like giving TypeScript a translated menu — now it knows exactly what each dish contains.

### 3. Added `DirectusSchema` Utility Type

**File:** `src/runtime/schema-utils.ts`

The Directus SDK expects types in one format, but the OpenAPI generator produces them in a different format:

| OpenAPI format (from generator) | SDK format (what Directus expects) |
|---|---|
| `ItemsBlogposts: { id: string, title: string }` | `blogposts: { id: string, title: string }[]` |
| `ItemsPages: { id: string, slug: string }` | `pages: { id: string, slug: string }[]` |

Notice three differences:
1. **Prefix removed** — `ItemsBlogposts` becomes `blogposts`
2. **Lowercase** — `Blogposts` becomes `blogposts`
3. **Array wrapper** — the SDK wraps each type in `[]`

The `DirectusSchema<T>` type does this conversion automatically:

```typescript
import type { DirectusSchema } from '@nuxtus/nuxt-module'
import type { components } from './nuxtus'

// This:
type Schema = DirectusSchema<components['schemas']>

// Becomes:
// {
//   blogposts: { id: string; title: string; ... }[]
//   pages: { id: string; slug: string; ... }[]
//   ...
// }
```

## How to Use This in Your App

### Step 1: Create a schema file

Create a file like `interfaces/directus-schema.ts`:

```typescript
import type { components } from './nuxtus'
import type { DirectusSchema } from '@nuxtus/nuxt-module'

// Regular collections (blogs, pages, etc.) — auto-converted
type Collections = DirectusSchema<components['schemas']>

// Singleton collections (globals, settings) — manual override
type Singletons = {
  global: components['schemas']['ItemsGlobal']
}

export type Schema = Collections & Singletons
```

### Step 2: Configure the module

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    ['@nuxtus/nuxt-module', { schemaPath: 'interfaces/directus-schema.ts' }]
  ]
})
```

### Step 3: Enjoy autocomplete

```typescript
const { $directus, $readItems } = useNuxtApp()

// TypeScript now knows:
// - 'blogposts' is a valid collection name
// - The return type has .title, .slug, .content, etc.
// - If you typo a field name, you get an error
const posts = await $directus.request(
  $readItems('blogposts', { fields: ['id', 'title', 'slug'] })
)
```

## Backward Compatibility

- **No `schemaPath`?** No problem. The module works exactly as before, just without the "everything is an error" problem. You get `any` types instead of `never` types — no breaking changes.
- **Existing apps don't need to change anything.** This is a safe upgrade.
- **The `DirectusSchema` export is optional.** You only use it if you want full typing.

## Files Changed in This Branch

| File | Change |
|------|--------|
| `src/runtime/plugin.ts` | `Record<string, never>` → `Record<string, any>`; `checkError` accepts `undefined` |
| `src/runtime/schema-utils.ts` | **New** — `DirectusSchema<T>` utility type |
| `src/module.ts` | Added `schemaPath` option + `addTypeTemplate` augmentation generator; exports `DirectusSchema` |
| `package.json` | Version bump `2.4.4` → `2.4.5` |

## For Upstream Maintainers

This change is designed to be minimal and upstream-able:

- No runtime behavior changes — purely a TypeScript improvement
- Backward compatible — `schemaPath` defaults to empty (opt-in)
- The `DirectusSchema` type is a standalone export with no dependencies
- The augmentation template only runs when `schemaPath` is configured
