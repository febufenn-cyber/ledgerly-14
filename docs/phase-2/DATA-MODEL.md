# Phase 2 data model

## Canonical taxonomy

`canonical_categories` contains Ledgerly semantic categories. These are global read-only reference values, not a customer's chart of accounts.

## Organization account mapping

`organization_category_mappings` maps a canonical category to the organization's actual account name and optional external code. Mapping changes are audited.

## Rules

`classification_rules` stores an entity-scoped predicate, category action, priority, specificity, source role, lifecycle status, and version. Rule predicates are structured JSON; arbitrary executable expressions are forbidden.

## Decisions

`classification_decisions` is append-only history. A partial unique index permits only one current decision per transaction. Suggestions, approvals, corrections, conflicts, and superseded decisions remain distinguishable.

## Corrections

`correction_events` links the previous decision, new human decision, selected correction scope, and any generated rule. A transaction-only correction has no generated rule.

## Write boundary

Tables expose member-scoped reads through RLS. Consequential writes occur through security-definer RPCs that validate organization role, category and mapping ownership, rule predicates, and transaction ownership.
