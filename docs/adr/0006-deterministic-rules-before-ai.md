# ADR 0006 — Deterministic rules before AI categorization

## Context

Committed transactions need useful categorization, but merchant identity and model confidence are insufficient accounting evidence. Corrections can also overgeneralize if their future scope is implicit.

## Decision

Phase 2 uses only structured, entity-scoped deterministic rules. Every correction has an explicit scope. Suggestions retain source-rule evidence, conflicts stay unresolved, and approved decisions are never overwritten by a rule run.

## Consequences

Coverage grows more slowly than an unconstrained model-based approach, but behavior is reproducible, reviewable, disableable, and safe to evaluate. AI ambiguity resolution remains a later phase behind the same decision and evidence contracts.
