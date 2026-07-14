# Phase 3 threat model

## Protected assets

Transaction evidence, organization accounting memory, account mappings, accepted decisions, model credentials, prompt templates, provider usage, and audit history.

## Threats and required controls

### Prompt injection

Transaction descriptions, counterparties, references, receipts, and imported fields are untrusted data. They are serialized as data fields, never concatenated as system or developer instructions. Output cannot request tools or actions.

### Fabricated evidence

Every evidence reference must exist in the request's authorized evidence set. Unknown references invalidate the output and leave the transaction unresolved.

### Unsupported category or unsafe routing

The model may select only categories supplied in the request. High-risk categories always require accountant review. Model confidence never changes approval state.

### Cross-tenant leakage

AI runs, evidence, budgets, prompts, and outputs carry `organization_id`, use RLS, and are accessed through the authenticated user token. Global prompts contain no customer data.

### Sensitive provider disclosure

The minimizer excludes account numbers, credentials, raw files, unrelated history, organization secrets, and unnecessary personal data. Operational logs contain IDs, versions, counts, latency, and error codes—not descriptions or provider payloads.

### Replay, duplication, and stale evidence

Idempotency binds transaction evidence version, deterministic result version, model, prompt, policy, and schema. Stale or duplicate runs cannot create multiple current suggestions.

### Provider compromise or failure

Timeouts, bounded retries, budgets, feature flags, and circuit breakers limit damage. Provider errors and invalid responses become unresolved results; no fallback invents a category.

### Model drift

Frozen fixtures and per-version evaluation metrics detect schema, safety, precision, escalation, latency, and cost regressions. Production activation remains blocked until reviewed thresholds are met.

## Release blockers

Any path that approves a model suggestion, creates a future rule, references unauthorized evidence, exposes another tenant, logs raw financial text, or overwrites a human decision blocks release.
