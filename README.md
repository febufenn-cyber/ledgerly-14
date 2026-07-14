# Ledgerly

> An India-first month-end close co-pilot that turns financial feeds into a reconciled, explainable, accountant-ready review package.

## Current implementation

- **Phase 0:** accounting constitution, risk boundaries, schemas, and evaluation policy.
- **Phase 1:** trustworthy CSV ingestion and normalization backend.
- **Phase 2:** deterministic categorization rules and correction memory.

Phase 1 provides a Cloudflare Worker/Hono API, Supabase Auth/Postgres/RLS schema, private R2 source storage, deterministic CSV detection and normalization, duplicate-safe staging, atomic commit RPCs, import manifests, and audit events.

Phase 2 adds canonical categories, organization account mappings, entity-scoped structured rules, deterministic suggestions, conflict detection, review queues, explicit correction scopes, append-only decision history, and disableable correction-generated memory. It performs no model calls and does not auto-approve suggestions.

Seven repository phases remain: structured AI ambiguity, the exception-review cockpit, reconciliation, month-end close, safe exports, pilot hardening, and controlled autonomy.

```bash
npm install --ignore-scripts
npm run check
python3 scripts/validate_build_plan.py
```

Read:

- [`docs/phase-0/ACCOUNTING-CONSTITUTION.md`](docs/phase-0/ACCOUNTING-CONSTITUTION.md)
- [`docs/phase-1/PHASE-1-SPEC.md`](docs/phase-1/PHASE-1-SPEC.md)
- [`docs/phase-1/API.md`](docs/phase-1/API.md)
- [`docs/phase-2/PHASE-2-SPEC.md`](docs/phase-2/PHASE-2-SPEC.md)
- [`docs/phase-2/API.md`](docs/phase-2/API.md)
- [`docs/phase-2/GO-NO-GO.md`](docs/phase-2/GO-NO-GO.md)
- [`docs/roadmap/AUTONOMOUS-BUILD-PLAYBOOK.md`](docs/roadmap/AUTONOMOUS-BUILD-PLAYBOOK.md)
- [`roadmap/remaining-phases.json`](roadmap/remaining-phases.json)

## Future build command

`BUILD` means: validate the roadmap, choose the next incomplete phase, create its phase-specific specification, implement it through green dependency-ordered PRs, squash-merge each PR into `main`, verify the final main commit, update the roadmap, and report the merge evidence and remaining external production gates.

`BUILD PHASE N` targets a named phase but still refuses to skip incomplete repository dependencies.

Repository implementation and production activation are separate claims. Provider credentials, live RLS tests, accountant reviews, real pilots, and shadow-mode evidence remain external gates where documented.

## Core pipeline

```text
private content-addressed source file
  → immutable raw rows
  → versioned parsing attempt
  → deterministic normalization
  → duplicate assessment
  → atomic commit
  → active normalized movements
  → entity-scoped rule evaluation
  → explainable suggestion / visible conflict / unresolved
  → human approval or scoped correction
  → append-only accounting memory
```

Ledgerly does not yet call an AI categorization model, file tax, generate journals, or post to accounting systems.

## Development

```bash
npm run dev
npm run typecheck
npm test
python3 scripts/validate_phase0.py
python3 scripts/validate_build_plan.py
```

Deployment requires a Supabase project and private R2 bucket. Apply migrations in order and complete each phase's go/no-go checks before production activation.
