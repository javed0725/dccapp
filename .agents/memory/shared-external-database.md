---
name: Shared external database
description: Scope production schema changes safely when the external database contains tables outside this app
---

The external production database contains tables outside this application's schema. Never force a full schema synchronization that proposes renaming or removing those objects.

**Why:** Schema introspection offered unrelated production tables as rename candidates for a newly introduced app table. Automatically accepting a broad diff could damage data belonging to other features or applications.

**How to apply:** Confirm the production target and obtain authorization before writing. Review the exact additive migration, restrict changes to the intended app-owned objects, and preserve unrelated tables and existing student records.
