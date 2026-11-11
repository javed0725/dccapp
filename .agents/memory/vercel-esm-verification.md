---
name: Vercel ESM verification
description: Why production startup checks must run the emitted backend without bundling.
---

Verify Vercel startup using an emitted, unbundled ESM module tree with native Node request/response objects, not only an esbuild bundle.

**Why:** Bundled smoke checks repeatedly passed while Vercel's runtime failed to resolve extensionless imports. Bundlers also resolve TypeScript path aliases that Node itself cannot resolve, hiding another failure in the same dependency chain.

**How to apply:** When changing backend imports or serverless startup, check every runtime import reachable from the API entrypoint. Use Node-compatible compiled-file specifiers and relative paths instead of compiler-only aliases. Transpile the graph without bundling and exercise health and invalid-credential login requests before requesting a production redeployment.
