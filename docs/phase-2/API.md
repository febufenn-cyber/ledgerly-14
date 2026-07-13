# Phase 2 API

All Phase 2 endpoints require a valid Supabase bearer token. Organization ownership and roles are enforced by RLS and security-definer RPCs.

## Categories and mappings

- `GET /v1/organizations/:organizationId/categories`
- `PUT /v1/organizations/:organizationId/category-mappings`

A mapping connects a Ledgerly canonical category to the organization's account name and optional external code.

## Rules

- `GET /v1/organizations/:organizationId/rules`
- `POST /v1/organizations/:organizationId/rules`
- `POST /v1/rules/:ruleId/disable`

Rules accept only structured predicates. Transaction descriptions are data values, not executable expressions.

## Evaluation and queue

- `POST /v1/organizations/:organizationId/categorization/run?limit=100`
- `GET /v1/organizations/:organizationId/categorization/queue?status=suggested&limit=100`

Supported queue statuses are `unclassified`, `suggested`, `conflict`, `unresolved`, `approved`, and `corrected`.

## Corrections

- `POST /v1/transactions/:transactionId/classification`

Example:

```json
{
  "organizationId": "00000000-0000-0000-0000-000000000000",
  "canonicalCategoryCode": "expense.software_subscription",
  "organizationCategoryMappingId": null,
  "scope": "recurring_series",
  "reason": "Confirmed monthly design software subscription"
}
```

`transaction_only` creates no rule. Every broader scope creates an inspectable organization rule and an append-only correction event.
