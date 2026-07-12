# Phase 0 Charter — Accounting Constitution

## Mission

Prevent Ledgerly from becoming a convincing interface over unreliable books. Phase 0 pre-registers what the product may handle, what it must escalate, which evidence it must preserve, and what must be proven before Phase 1.

## Product thesis

Ledgerly is a **reconciliation-and-exception system first**. Categorization is one controlled service inside a larger close workflow.

## In scope

- India-first service businesses, agencies, consultants, and small SaaS companies.
- One entity and one primary functional currency.
- Bank and payment-processor evidence.
- Founder context plus accountant review.
- Canonical transaction ontology, accounting categories, audit events, correction rules, confidence bands, fixtures, and evaluation gates.

## Explicitly out of scope

- Tax filing or statutory advice.
- Inventory valuation and cost of goods sold automation.
- Payroll accounting.
- Multi-entity consolidation.
- Automated depreciation, revenue recognition, complex accruals, or FX gains/losses.
- Autonomous final journal posting.
- Replacing a CA or accountant.

## Required Phase 0 outputs

1. Accounting constitution.
2. Ideal customer and product promise.
3. Supported-scenario matrix.
4. Canonical transaction ontology and JSON contracts.
5. Correction, confidence, and automation policy.
6. Roles, approvals, and exception-review UX.
7. Threat model and privacy boundaries.
8. Synthetic fixture corpus and executable validator.
9. ADRs and decision log.
10. External accountant red-team template and go/no-go gate.

## Working principles

- Risk reduction before feature accumulation.
- Precision before coverage.
- Deterministic controls before AI reasoning.
- Evidence before explanation.
- Unresolved is better than confidently wrong.
- Automation is earned per transaction class.

## Phase completion definition

Repository implementation is complete when all required artifacts exist and `python3 scripts/validate_phase0.py` passes. Product authorization to begin Phase 1 remains blocked until the external gates in `GO-NO-GO.md` are signed off.
