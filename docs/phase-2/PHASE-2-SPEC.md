# Phase 2 — Deterministic categorization and correction memory

## Objective

Turn committed Phase 1 financial movements into explainable category suggestions using entity-specific deterministic rules. Human corrections create versioned decisions and, only when explicitly scoped, future rules.

## Product boundary

Phase 2 includes canonical categories, organization account mappings, explicit rules, rule evaluation, suggestion queues, approvals/corrections, conflict visibility, and correction history.

Phase 2 excludes model calls, receipt interpretation, autonomous posting, tax decisions, journal entries, settlement reconciliation, and silent historical rewrites.

## Decision order

1. Accountant-created entity rule.
2. Founder-created entity rule.
3. More specific predicate.
4. Higher explicit priority.
5. Newer version only when all preceding factors are equal.

A tied top result with different categories is a conflict, not a guessed winner.

## Correction scopes

- `transaction_only`: approve this movement and create no rule.
- `exact_description`: exact normalized-description match.
- `merchant_amount_range`: same normalized counterparty within an explicit amount range.
- `recurring_series`: stable entity-scoped recurrence key.
- `merchant_entity_future`: all future movements for the normalized counterparty.
- `historical_and_future_matches`: create a rule and allow a separate controlled backfill run.

## Safety rules

- Rules are organization-scoped.
- A correction never deletes a prior decision.
- Approved or corrected decisions cannot be replaced by a rule run.
- Rule suggestions remain reviewable; Phase 2 does not auto-approve them.
- High-risk categories remain review-visible regardless of match strength.
- Imported descriptions remain untrusted data.
- Conflicts remain first-class queue states.

## Exit criteria

- Rule matching is deterministic and fully unit tested.
- Every suggestion identifies its source rule and evidence.
- Conflicting top rules are visible.
- Transaction-only corrections create no future behavior.
- Scoped corrections create inspectable, disableable rules.
- Re-running rules is idempotent with respect to approved decisions.
- RLS prevents cross-tenant category, rule, decision, and correction access.
