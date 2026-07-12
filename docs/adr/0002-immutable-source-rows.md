# ADR 0002 — Immutable source rows

## Context

Normalization, rules, and models can change. Reproducibility requires original evidence.

## Decision

Persist imported files and raw rows immutably. All normalized fields, classifications, relationships, and journals are derived records linked to source evidence.

## Consequences

Storage use increases, but audits, reprocessing, model comparison, and error recovery remain possible. Deletion follows explicit retention/privacy policy rather than accidental mutation.
