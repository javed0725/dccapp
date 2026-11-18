---
name: Vercel dependency compatibility
description: Vercel function-build parsing issues with export-namespace syntax in transitive packages.
---

Vercel's function builder can send transitive package declaration files through Babel. Besides Zod 3.25's bundled v4 source, it failed while parsing `tslib/modules/index.d.ts` from tslib 2.8.1; the problematic export syntax was in the declaration file, not the runtime `.js` file. Tslib 2.4.1 has no `modules/index.d.ts`, so it avoids that specific parser path. Adding `@vercel/node` 31 only for types also exposed `tar` 7.5's ESM namespace export to Babel; use native `node:http` request/response types at the Vercel boundary instead. A clean pnpm install also exposed imports that npm hoisting had hidden.

**Why:** Vercel's build logs showed the exact source excerpt and pnpm version; inspecting package contents showed the syntax remained in the tslib declaration and tar runtime module despite local builds succeeding.

**How to apply:** When Babel reports export-namespace syntax, inspect the exact resolved file and package export conditions, including `.d.ts` files. Avoid adding a type-only dependency that introduces an incompatible transitive package; use built-in Node types at the Vercel handler boundary where possible. Validate with the lockfile Vercel selects, and keep npm's root `overrides`, pnpm's `pnpm.overrides`, and both lockfiles aligned.
