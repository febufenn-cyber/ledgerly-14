# Phase 3 — Structured AI Ambiguity Engine

## Objective

Provide provider-neutral, evidence-bound suggestions only for committed transactions that deterministic Phase 2 rules leave unresolved or conflicting. A model may propose a category, alternatives, or a question. It cannot approve a transaction, create a rule, generate a journal, post an entry, or modify a locked period.

## Execution order

1. Load the committed transaction and current deterministic outcome.
2. Resolve allowed canonical categories and authorized evidence identifiers.
3. Build a minimized structured envelope. Imported descriptions remain untrusted data fields.
4. Calculate an idempotency key from evidence, model, prompt, policy, and schema versions.
5. Reuse an existing successful run when the key matches.
6. Call a provider adapter behind feature, budget, timeout, retry, and circuit-breaker gates.
7. Parse the response with a strict schema.
8. Apply accounting policy: allowed category, authorized evidence, high-risk routing, suggestion-only status.
9. Persist the run and suggestion, or a safe unresolved failure.
10. Surface the result without hiding deterministic conflicts.

## Input contract

The provider receives the transaction ID and evidence version; date, integer amount, currency and direction; quoted description/counterparty text; deterministic outcome; allowed categories with risk; authorized evidence IDs; and prompt, policy, model, and schema versions. Full account identifiers, credentials, unrelated transactions, raw files, and organization secrets are excluded.

## Output contract

A response is `suggestion`, `insufficient_evidence`, or `refusal`. Suggestions contain one allowed category, optional alternatives, authorized evidence references, reason codes, confidence (`unknown`, `low`, `medium`, `high`), an optional founder question, and review routing. Every AI result requires founder review; high-risk categories require accountant review.

## Provider neutrality

Domain code depends on `AiModelAdapter`, not a vendor SDK. Adapters return untrusted JSON plus usage metadata. A deterministic fake adapter is the authoritative CI provider.

## Failure behavior

Malformed output, unknown category, fabricated evidence, timeout, rate limit, budget exhaustion, circuit-open state, or provider failure persists an unresolved run and leaves prior decisions untouched.

## Repository boundary

Repository completion includes contracts, persistence, service, authenticated API, synthetic evaluation, and CI safety gates. Live credentials, provider privacy approval, accountant-reviewed accuracy, and production activation remain external gates.
