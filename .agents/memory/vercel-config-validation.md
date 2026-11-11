---
name: Vercel configuration validation
description: Validate deployment-specific asset packaging separately from the application build.
---

Check Vercel configuration against its official schema when changing function packaging. `includeFiles` accepts one glob string, not an array; brace expansion can cover multiple asset locations.

**Why:** A passing production build and native ESM startup test did not catch an invalid packaging configuration. Vercel rejected the deployment before running the build, so build events were empty; the deployment detail API contained the schema error.

**How to apply:** Use the current schema at `https://openapi.vercel.sh/vercel.json`, verify the asset glob matches the intended files, and inspect deployment detail errors when a deployment fails without build logs. Do not claim the local application build validates deployment configuration.
