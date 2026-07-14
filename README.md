# Ledgerly

> An India-first month-end close co-pilot that turns financial feeds into a reconciled, explainable, accountant-ready review package.

## Current implementation

- **Phase 0:** accounting constitution, risk boundaries, schemas, and evaluation policy.
- **Phase 1:** trustworthy CSV ingestion and normalization backend.
- **Phase 2:** deterministic categorization rules and correction memory.
- **Phase 3:** provider-neutral, evidence-bound AI ambiguity suggestions.

Phase 1 provides a Cloudflare Worker/Hono API, Supabase Auth/Postgres/RLS schema, private R2 source storage, deterministic CSV detection and normalization, duplicate-safe staging, atomic commit RPCs, import manifests, and audit events.

Phase 2 adds canonical categories, organization account mappings, entity-scoped structured rules, deterministic suggestions, conflict detection, review queues, explicit correction scopes, append-only decision history, and disableable correction-generated memory.

Phase 3 adds strict AI input/output contracts, organization opt-in, budgets/timeouts/retries/circuit state, RLS-protected model runs, evidence and category policy gates, idempotent provider-neutral execution, fail-closed unresolved fallback, a deterministic fake provider, authenticated policy/run/diagnostic APIs, and regression metrics. It never auto-approves or creates rules.

Six repository phases remain: the exception-review cockpit, reconciliation, month-end close, safe exports, pilot hardening, and controlled autonomy.

```bash
npm install --ignore-scripts
npm run check
python3 scripts/validate_build_plan.py
```

Read:

- [`docs/phase-0/ACCOUNTING-CONSTITUTION.md`](docs/phase-0/ACCOUNTING-CONSTITUTION.md)
- [`docs/phase-1/PHASE-1-SPEC.md`](docs/phase-1/PHASE-1-SPEC.md)
- [`docs/phase-2/PHASE-2-SPEC.md`](docs/phase-2/PHASE-2-SPEC.md)
- [`docs/phase-3/PHASE-3-SPEC.md`](docs/phase-3/PHASE-3-SPEC.md)
- [`docs/phase-3/API.md`](docs/phase-3/API.md)
- [`docs/phase-3/GO-NO-GO.md`](docs/phase-3/GO-NO-GO.md)
- [`docs/roadmap/AUTONOMOUS-BUILD-PLAYBOOK.md`](docs/roadmap/AUTONOMOUS-BUILD-PLAYBOOK.md)
- [`roadmap/remaining-phases.json`](roadmap/remaining-phases.json)

## Future build command

`BUILD` validates the roadmap, chooses the next incomplete phase, implements it through green dependency-ordered PRs, squash-merges each PR into `main`, updates the roadmap, verifies the final main commit, and reports merge evidence and remaining external gates.

`BUILD PHASE N` targets a named phase but refuses to skip incomplete repository dependencies.

Repository implementation and production activation are separate claims. Live provider credentials, live RLS tests, accountant reviews, real pilots, and shadow-mode evidence remain external gates where documented.

## Core pipeline

```text
private content-addressed source file
  → immutable raw rows
  → deterministic normalization and duplicate-safe commit
  → entity-scoped deterministic rule evaluation
  → unresolved / visible conflict
  → minimized evidence-bound AI suggestion or safe unresolved fallback
  → human approval or explicitly scoped correction
  → append-only accounting memory
```

Ledgerly does not yet provide the review cockpit, reconcile settlements, close periods, generate journal drafts, export to accounting systems, or enable autonomy.

## Development

```bash
npm run dev
npm run typecheck
npm test
python3 scripts/validate_phase0.py
python3 scripts/validate_build_plan.py
```

Deployment requires a Supabase project and private R2 bucket. Apply migrations in order and complete each phase's go/no-go checks before production activation.
