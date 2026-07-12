# Rules, confidence, and automation policy

## Rule priority

1. Entity-specific explicit accountant-approved rule.
2. Entity-specific explicit founder rule.
3. Exact recurring-series rule.
4. Exact prior accepted match.
5. Merchant and constrained amount/pattern rule.
6. Structured AI suggestion.

A more specific rule beats a broader rule. Conflicts remain visible and block automation.

## Correction scopes

- `transaction_only`
- `exact_description`
- `merchant_amount_range`
- `recurring_series`
- `merchant_entity_future`
- `historical_and_future_matches`

Every generated rule records creator, scope, predicate, action, creation evidence, approval state, and revocation state.

## Confidence bands

- `unknown`: insufficient evidence; no actionable suggestion.
- `low`: suggestion only; mandatory individual review.
- `medium`: reviewable and groupable; never auto-approved.
- `high`: strong evidence; available for quick approval but visible.
- `automation_eligible`: stable, low-risk, empirically calibrated, and explicitly enabled for this entity.

Percentages may be displayed only when calibrated against frozen labeled data. Model self-confidence alone is not calibration.

## Automation eligibility

Requires all of:

- at least five accepted comparable decisions;
- no recent correction or unresolved conflict;
- stable counterparty and recurrence pattern;
- amount within expected bounds;
- low-risk category;
- no owner, personal, asset, tax, related-party, loan, or foreign-currency ambiguity;
- explicit organization permission.

## Never auto-approve

Owner capital/drawings, personal expenses, loans, fixed assets, tax payments, related-party transactions, large unusual transactions, foreign-currency adjustments, and any case with conflicting evidence.

## Model changes

A model, prompt, retrieval, or policy change must run against the frozen Phase 0 corpus. Regression in high-confidence precision or escalation recall blocks release.
