# Threat model

## Protected assets

Bank statements, payment-processor data, transaction descriptions, counterparty names, receipts, accounting decisions, chart mappings, export credentials, and audit history.

## Primary threats

### Tenant and access threats

- Cross-organization reads or writes.
- Service-role bypass of row-level security.
- Accountant access to unrelated clients.
- Support/debug tools exposing raw financial data.

### Data-integrity threats

- Silent parser loss.
- Duplicate imports or export retries.
- Revenue double counting across processor and bank feeds.
- Rule changes affecting locked periods.
- Synthetic balancing adjustments.

### AI threats

- Prompt injection in CSV cells, transaction descriptions, receipts, or merchant metadata.
- Hallucinated merchant identity or evidence.
- Model regression masked by aggregate accuracy.
- Uncalibrated confidence.
- Customer history leaking through global memory.

### Privacy threats

- Public object URLs.
- Sensitive descriptions in logs or traces.
- Excessive model-provider disclosure or retention.
- Incomplete deletion and retention workflows.

## Required mitigations

- Supabase RLS from migration one.
- Server-side organization authorization on every privileged operation.
- Private storage and expiring signed URLs.
- No account numbers or raw descriptions in application logs.
- Minimized/redacted model inputs and traces.
- Imported text always encoded as data fields, never concatenated into instruction authority.
- Append-only audit events.
- Idempotency keys for imports and exports.
- Locked-period enforcement below the UI layer.
- Automated cross-tenant and prompt-injection tests before production.

## Residual risk policy

High-impact uncertain accounting treatment is routed to a qualified human. Security or integrity defects affecting source truth, tenant isolation, reconciliation, journals, or locked periods are release blockers.
