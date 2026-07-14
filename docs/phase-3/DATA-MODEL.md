# Phase 3 data model

## `ai_prompt_versions`

Immutable prompt/schema/policy release metadata. Templates are identified by code, version, and SHA-256; customer evidence is never stored here.

## `organization_ai_policies`

Entity-level opt-in and operational limits: provider/model, versions, monthly budget, timeout, retry limit, and circuit state. The default is disabled. Only owners/admins can configure it.

## `ai_model_runs`

Immutable execution record keyed by organization and idempotency key. Stores minimized structured input, authorized evidence IDs, allowed category codes, versions, status, safe output, usage, cost, latency, and provider request ID. It never stores credentials.

## `ai_suggestions`

Suggestion-only projection linked to the run and the current deterministic decision. It is deliberately separate from `classification_decisions`, so a model cannot replace a deterministic conflict or a human-approved decision. Only one AI suggestion may be current per transaction.

## Database gates

- `begin_ai_model_run` requires active organization membership, enabled policy, closed circuit, budget availability, transaction ownership, and a current unresolved/conflict deterministic decision.
- `complete_ai_model_run` validates status, suggestion-only review flag, allowed category, high-risk accountant routing, and authorized evidence IDs.
- Provider/policy failure creates an unresolved suggestion rather than guessing.
- RLS permits members to read only their organization; writes occur through role-checked security-definer functions.
