---
name: Vercel dependency compatibility
description: Vercel function-build parsing issues with export-namespace syntax in transitive packages.
---

Vercel's function builder can send transitive package declaration files through Babel. Besides Zod 3.25's bundled v4 source, it failed while parsing `tslib/modules/index.d.ts` from tslib 2.8.1; the problematic export syntax was in the declaration file, not the runtime `.js` file. Tslib 2.4.1 has no `modules/index.d.ts`, so it avoids that specific parser path. A clean pnpm install also exposed imports that npm hoisting had hidden.

**Why:** Vercel's build logs showed the exact source excerpt and pnpm version; inspecting the package tarball showed the syntax remained in 2.8.1's type declaration despite the runtime code being clean.

**How to apply:** When Babel reports export-namespace syntax, inspect the exact resolved file and package export conditions, including `.d.ts` files. Validate with the lockfile Vercel selects, and keep npm's root `overrides`, pnpm's `pnpm.overrides`, and both lockfiles aligned.
