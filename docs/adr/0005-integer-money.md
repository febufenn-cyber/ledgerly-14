# ADR 0005 — Integer minor-unit money

## Context

Binary floating-point arithmetic can introduce rounding defects in financial calculations.

## Decision

Store monetary amounts as non-negative integers in minor units and represent flow direction separately. Currency uses uppercase ISO 4217 codes.

## Consequences

Parsers and exports must handle decimal conversion explicitly. Arithmetic and equality checks become deterministic.
