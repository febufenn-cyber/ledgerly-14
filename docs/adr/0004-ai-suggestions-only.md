# ADR 0004 — AI suggestions only

## Context

Model output is probabilistic and may hallucinate evidence or mishandle high-risk accounting treatment.

## Decision

AI produces structured suggestions with evidence, alternatives, confidence band, and review routing. It cannot directly mutate approved or locked accounting records.

## Consequences

Automation coverage grows more slowly, while trust, evaluation, and safe model replacement improve. Controlled autonomy may be introduced later per verified transaction class.
