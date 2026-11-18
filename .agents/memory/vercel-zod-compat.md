---
name: Vercel and Zod compatibility
description: A Vercel function-build parsing issue involving Zod's bundled v4 modules.
---

The current Vercel function build path can fail on `zod/v4/core/index.js` with an export-namespace Babel transform error, even though application code imports the Zod v3 root entrypoint. Zod 3.25.x bundles the v4 source tree; pinning to 3.24.4 removes that source tree from the dependency package.

**Why:** The new Vercel project's deployment logs identified the Zod v4 core index as the source of the build failure.

**How to apply:** When upgrading Zod or changing the Vercel function builder, verify the actual Vercel build. Do not assume the app's import path prevents the builder from parsing bundled package files.
