# Ledgerly Accounting Constitution

This constitution is a product and engineering constraint. A feature that violates it is defective even if it appears useful.

## Article 1 — Preserve source truth

Original files and rows are immutable evidence. Normalized values, classifications, relationships, and journals are derived records and may never overwrite source fields.

## Article 2 — Trace every consequential transformation

Ledgerly records the prior value, new value, actor, timestamp, reason, rule/model version, evidence, and approval state for every consequential change.

## Article 3 — No silent data loss

Every imported row must end as accepted, rejected with a reason, potential duplicate, confirmed duplicate, needs mapping, or needs review. Parser failure is visible state, never disappearance.

## Article 4 — No false balancing

Ledgerly must not invent a plug, suspense adjustment, or synthetic row merely to make reconciliation equal zero. A difference remains visible until evidence explains it.

## Article 5 — No unbalanced journals

Journal drafts must satisfy total debits equals total credits. Approval and export of an unbalanced journal must be structurally impossible.

## Article 6 — AI is not source truth

AI output is a structured, versioned suggestion. It cannot directly modify approved or locked accounting records and must pass deterministic validation and accounting policy gates.

## Article 7 — Keep uncertainty visible

Valid outcomes include needs business context, accountant review required, potential transfer, potential fixed asset, insufficient evidence, and unsupported. Ledgerly does not force every row into a category.

## Article 8 — Protect closed periods

Locked periods reject automatic recategorization, model-driven edits, and rule reapplication. Reopening requires authorization, reason, and an append-only audit event.

## Article 9 — Entity isolation is absolute

Organization rules, corrections, merchant mappings, evidence, and history cannot leak across tenants. Safe global metadata must be explicitly identified and contain no customer accounting decisions.

## Article 10 — Automation must be earned

Automation requires stable repeated history, calibrated empirical precision, low accounting risk, no conflicting evidence, and explicit entity-level permission. It is granted per transaction class, not through a global autopilot switch.

## Non-negotiable implementation invariants

- Money uses integer minor units.
- Imported text is untrusted data.
- All external writes use idempotency protection.
- All organization-scoped access is authorized server-side.
- Every export has a manifest and destination identifiers.
- Every model and prompt version is recorded with its suggestion.
- Human approval authority is explicit and role-bound.
