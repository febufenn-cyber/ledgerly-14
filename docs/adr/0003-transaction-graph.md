# ADR 0003 — Transaction graph over flat-only records

## Context

A bank deposit can represent multiple charges, fees, refunds, and settlements. A flat categorized row cannot safely model these relationships.

## Decision

Separate source rows, normalized movements, financial events, components, relationships, and classification decisions.

## Consequences

The data model is more deliberate, but prevents processor revenue double counting, supports reconciliation, and preserves explainability.
