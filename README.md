# Ledgerly

> An India-first month-end close co-pilot that turns financial feeds into a reconciled, explainable, accountant-ready review package.

## Current implementation

- **Phase 0:** accounting constitution, risk boundaries, schemas, and evaluation policy.
- **Phase 1:** trustworthy CSV ingestion and normalization backend.

Phase 1 provides a Cloudflare Worker/Hono API, Supabase Auth/Postgres/RLS schema, private R2 source storage, deterministic CSV detection and normalization, duplicate-safe staging, atomic commit RPCs, import manifests, and audit events.

```bash
npm install --ignore-scripts
npm run check
```

Read:

- [`docs/phase-0/ACCOUNTING-CONSTITUTION.md`](docs/phase-0/ACCOUNTING-CONSTITUTION.md)
- [`docs/phase-1/PHASE-1-SPEC.md`](docs/phase-1/PHASE-1-SPEC.md)
- [`docs/phase-1/API.md`](docs/phase-1/API.md)
- [`docs/phase-1/GO-NO-GO.md`](docs/phase-1/GO-NO-GO.md)

## Core pipeline

```text
private content-addressed source file
  → immutable raw rows
  → versioned parsing attempt
  → deterministic normalization
  → duplicate assessment
  → review staging
  → atomic commit
  → active normalized movements
```

Ledgerly does not yet categorize transactions, file tax, generate journals, or post to accounting systems.

## Development

```bash
npm run dev
npm run typecheck
npm test
```

Deployment requires a Supabase project and private R2 bucket. See [`docs/phase-1/DEPLOYMENT.md`](docs/phase-1/DEPLOYMENT.md).
