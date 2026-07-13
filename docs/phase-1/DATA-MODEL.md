# Phase 1 data model

## Tenant foundation

- `organizations`
- `organization_members`
- `financial_accounts`

The organization creation trigger assigns the creator as owner. Every tenant-owned table carries `organization_id` and is protected by RLS.

## Import evidence

- `imports`: lifecycle and account/source association.
- `import_files`: immutable file metadata and SHA-256.
- `raw_rows`: original row text and parsed fields.
- `mapping_profiles`: versioned, revocable mappings.

## Processing

- `import_attempts`: parser/mapping/normalization versions and manifest.
- `normalized_transaction_staging`: derived movement or visible issue.
- `row_issues`: stable machine code plus human explanation.

## Active movements

`normalized_transactions` receives only staged rows explicitly eligible at commit. Potential and confirmed duplicates, rejected rows, and review-required rows remain linked to the import but are excluded from the active set.

## Identity layers

1. Exact file hash: byte-identical upload.
2. Raw row hash: provenance only.
3. Strong movement key: trustworthy external reference plus account/date/amount/direction.
4. Candidate similarity key: account/date/amount/direction/description; review only.

## Immutability

Source objects and raw rows are not updated by reprocessing. A new `import_attempt` records a new interpretation. Active movements retain source import, attempt, and raw-row references.
