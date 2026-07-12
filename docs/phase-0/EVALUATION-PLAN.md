# Evaluation plan

## Evaluation layers

### Ingestion

- 100% of source rows accounted for.
- 100% amount and sign normalization on the frozen corpus.
- Exact re-import creates zero duplicate normalized rows.
- Rejected rows retain reason and source reference.

### Classification

- High-confidence precision at least 98%.
- Unsupported/high-risk escalation recall at least 99%.
- Metrics reported per transaction class, not only aggregate.
- False automation rate is zero in the frozen corpus.

### Reconciliation

- Exact transfer pairs identified without treating them as income/expense.
- Settlement components do not double-count revenue.
- Differences are surfaced, never plugged.

### Explanation

- Evidence references exist and are not fabricated.
- Rule/model version is present.
- Alternatives and escalation state are structurally represented.

### Security

- Zero cross-tenant failures.
- Imported prompt-injection text cannot change system behavior.
- No sensitive values appear in logs used by automated tests.

## Frozen corpus

- `fixtures/phase-0/bank-edge-cases.csv`
- `fixtures/phase-0/expected-results.jsonl`
- `fixtures/phase-0/supported-scenarios.csv`

The corpus begins small to lock the contract. It must grow to at least 100 independently reviewed cases before an AI classifier is allowed into a user pilot.

## Release blockers

- Missing source row.
- Non-integer financial arithmetic.
- Unbalanced journal approval path.
- Incorrect high-confidence suggestion in a high-risk class.
- Unsupported case silently categorized.
- Tenant-isolation failure.
- Prompt-injection instruction obeyed.
- Locked-period mutation without reopening event.

## Executable check

`python3 scripts/validate_phase0.py` validates artifact completeness, JSON syntax, category uniqueness, fixture identifiers, integer amounts, and policy enums. Future phases must extend this into behavioral tests rather than replace it.
