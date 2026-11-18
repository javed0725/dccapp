---
name: Vercel dependency compatibility
description: Vercel function-build parsing issues with export-namespace syntax in transitive packages.
---

Vercel's Node function builder can parse transitive package files that application code does not directly select. It failed on Zod 3.25's bundled `zod/v4/core/index.js`, then on the `tslib` 2.9 module entry, both with an export-namespace Babel transform error. A clean pnpm install also exposed imports that npm hoisting had hidden.

**Why:** The new Vercel project's build logs identified these modules, while pnpm was the install manager selected from the repository's lockfile.

**How to apply:** Validate with a clean install from the lockfile Vercel selects and check the actual Vercel build. When constraining a package in this repository, keep npm's root `overrides`, pnpm's `pnpm.overrides`, and both lockfiles aligned.
