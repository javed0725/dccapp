---
name: Package installation side effects
description: Environment-specific changes that can appear when installing frontend dependencies through the package manager.
---

When adding a frontend dependency through the managed package installer, review the diff beyond package.json and the intended lockfile entry. The installer can add an unrelated language module to `.replit` and rewrite optional dependency metadata in `package-lock.json`.

**Why:** This happened while adding the canvas-rendering dependency; the application still built, but the incidental environment changes were unrelated to the feature.

**How to apply:** Restore unrelated `.replit` module changes through the validated Replit config flow, and inspect lockfile diffs before finishing. Keep the new direct dependency and its resolved package entries.
