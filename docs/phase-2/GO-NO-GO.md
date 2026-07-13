# Phase 2 go/no-go gate

Repository implementation is complete only after the migration, engine, service, API, and tests are merged. Production activation remains conditional.

## Repository gate

- [x] Entity-scoped rule and correction schema.
- [x] RLS-protected category memory.
- [x] Deterministic rule engine.
- [x] Conflict visibility.
- [x] Explicit correction scopes.
- [x] Human decisions protected from reruns.
- [x] API and automated tests.

## Pre-production gate

- [ ] Apply Phase 2 migration to a non-production Supabase project.
- [ ] Run two-user cross-tenant tests for all new tables and RPCs.
- [ ] Verify founder and accountant role differences with real JWTs.
- [ ] Test at least 100 accountant-reviewed transaction cases.
- [ ] Confirm top-rule conflict behavior with seeded contradictory rules.
- [ ] Confirm disabled rules stop affecting new runs.
- [ ] Confirm transaction-only corrections create no rule.
- [ ] Inspect logs for absence of descriptions and category decisions.
- [ ] Obtain accountant review of high-risk routing.

## Explicitly disabled

- AI/model categorization.
- Automatic approval.
- Historical backfill without an explicit user action.
- Journal creation or posting.
- Tax-treatment decisions.
