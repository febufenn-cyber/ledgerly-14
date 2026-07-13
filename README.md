# Ledgerly

> An India-first month-end close co-pilot that turns financial feeds into a reconciled, explainable, accountant-ready review package.

## Current implementation

- **Phase 0:** accounting constitution, risk boundaries, schemas, and evaluation policy.
- **Phase 1:** trustworthy CSV ingestion and normalization backend.
- **Phase 2:** deterministic categorization rules and correction memory.

Phase 1 provides a Cloudflare Worker/Hono API, Supabase Auth/Postgres/RLS schema, private R2 source storage, deterministic CSV detection and normalization, duplicate-safe staging, atomic commit RPCs, import manifests, and audit events.

Phase 2 adds canonical categories, organization account mappings, entity-scoped structured rules, deterministic suggestions, conflict detection, review queues, explicit correction scopes, append-only decision history, and disableable correction-generated memory. It performs no model calls and does not auto-approve suggestions.

```bash
npm install --ignore-scripts
npm run check
```

Read:

- [`docs/phase-0/ACCOUNTING-CONSTITUTION.md`](docs/phase-0/ACCOUNTING-CONSTITUTION.md)
- [`docs/phase-1/PHASE-1-SPEC.md`](docs/phase-1/PHASE-1-SPEC.md)
- [`docs/phase-1/API.md`](docs/phase-1/API.md)
- [`docs/phase-2/PHASE-2-SPEC.md`](docs/phase-2/PHASE-2-SPEC.md)
- [`docs/phase-2/API.md`](docs/phase-2/API.md)
- [`docs/phase-2/GO-NO-GO.md`](docs/phase-2/GO-NO-GO.md)

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
```

Deployment requires a Supabase project and private R2 bucket. Apply migrations in order and complete each phase's go/no-go checks before production activation.
