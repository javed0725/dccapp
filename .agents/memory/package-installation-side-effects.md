---
name: Package installation side effects
description: Environment-specific changes that can appear when installing frontend dependencies through the package manager.
---

When adding a frontend dependency through the managed package installer, review the diff beyond package.json and the intended lockfile entry. The installer can add an unrelated language module to `.replit` and rewrite optional dependency metadata in `package-lock.json`.

**Why:** This happened while adding the canvas-rendering dependency; the application still built, but the incidental environment changes were unrelated to the feature.

**How to apply:** Restore unrelated `.replit` module changes through the validated Replit config flow, and inspect lockfile diffs before finishing. Keep the new direct dependency and its resolved package entries.

An imported pnpm-created dependency tree can fail during a managed npm incremental install and leave package CLI links missing.

**Why:** npm's Arborist failed while retiring a mixed dependency tree, even though the package download succeeded. A clean reconstruction worked.

**How to apply:** Prefer rebuilding dependencies against the original lockfile over repeatedly installing into a partially modified mixed tree. Recheck package versions and public registry references afterward; reinstalls can introduce internal registry URLs unrelated to the feature.
