# Phase 3 API

All Phase 3 endpoints require a valid Supabase bearer token and remain subject to organization RLS.

## Configure policy

`PUT /v1/organizations/:organizationId/ai/policy`

Repository builds accept only the deterministic `fake` / `fixture-v1` provider. The policy includes explicit enablement, prompt/policy/schema versions, monthly budget, timeout, and retry limit. Enabling a live provider is outside repository completion.

## Read policy

`GET /v1/organizations/:organizationId/ai/policy`

Returns organization-scoped configuration. Credentials are never returned or stored in this table.

## Request a suggestion

`POST /v1/organizations/:organizationId/transactions/:transactionId/ai-suggestion`

The transaction must have a current Phase 2 `unresolved` or `conflict` decision. The response is a suggestion-only result or a fail-closed unresolved result. Repeating the same evidence/model/prompt/policy/schema combination reuses the idempotent run.

## List current suggestions

`GET /v1/organizations/:organizationId/ai/suggestions?limit=100`

Returns current AI projections. Deterministic and human decisions remain stored separately and authoritative.

## Run diagnostics

`GET /v1/ai/runs/:runId`

Returns provider/model/version, status, safe error code, token counts, estimated cost, latency, and timestamps. It deliberately excludes minimized input, descriptions, raw output, evidence text, and credentials.

## Error behavior

Disabled policy, ineligible transaction, exhausted budget, open circuit, unavailable provider, timeout, invalid output, or evidence-policy rejection never applies a category. The run remains inspectable and the transaction remains unresolved for human review.
