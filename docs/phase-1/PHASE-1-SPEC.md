# Phase 1 — Trustworthy ingestion and normalization

## Objective

Accept bank/payment CSV evidence without losing, duplicating, corrupting, misreading, or silently changing any row.

Phase 1 deliberately stops before accounting categorization. Its output is a complete, versioned, reviewable set of normalized financial movements.

## User workflow

1. Authenticate through Supabase.
2. Create an India/INR organization.
3. Add a financial account.
4. Create an import session.
5. Upload a CSV to private R2 storage.
6. Detect encoding, delimiter, header, and date ambiguity.
7. Confirm a mapping.
8. Stage a versioned parsing attempt.
9. Review all row dispositions and duplicate candidates.
10. Atomically commit accepted movements.
11. Receive an immutable import manifest and audit event.

## Architectural pipeline

```text
source bytes
  → private immutable object
  → raw rows
  → versioned import attempt
  → deterministic normalization
  → duplicate assessment
  → staging/review
  → atomic commit RPC
  → active normalized transactions
```

No endpoint directly converts an upload into active transactions.

## Scope

- Cloudflare Worker/Hono API.
- Supabase Auth, Postgres, and RLS.
- Private Cloudflare R2 source storage.
- Generic bank CSV support.
- UTF-8 and Windows-1252 text decoding.
- Comma, semicolon, tab, and pipe delimiters.
- Indian and conventional decimal grouping.
- INR as the supported functional currency.
- Exact file duplicates, strong-reference duplicates, and fuzzy candidates.
- Immutable raw rows, attempt history, audit events, and import manifests.

## Deferred

AI categorization, live bank connections, settlement decomposition, account reconciliation, tax treatment, journal entries, receipt OCR, multi-currency conversion, and accounting-system exports.

## Safety decisions

- Imported content is inert data.
- Money is integer minor units.
- Fuzzy duplicates are never silently removed.
- Reprocessing creates a new attempt.
- Exact file re-upload is rejected before object creation.
- R2 object creation is rolled back when metadata persistence fails.
- Commit is a single Postgres transaction.
- Only organization roles with review authority may stage or commit.
