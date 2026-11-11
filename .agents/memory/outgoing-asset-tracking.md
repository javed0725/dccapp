---
name: Outgoing asset tracking
description: Prevent locally available but untracked assets from breaking remote builds.
---

Inspect the complete outgoing commit range before pushing, not only the working-tree diff.

**Why:** An automatic pre-merge checkpoint removed existing assets from Git tracking while leaving identical files on disk. Local builds still passed, but Vercel failed because its checkout lacked an imported login image.

**How to apply:** Check outgoing commits for unexpected deletions and ensure imported assets remain present in the Git tree. If tracking is lost while files remain locally, verify their hashes against the previous tree before restoring tracking. Do not treat a clean working tree or successful local build alone as proof that deployment inputs are complete.
