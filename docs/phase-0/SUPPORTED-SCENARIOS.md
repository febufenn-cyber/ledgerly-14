# Supported-scenario policy

The machine-readable matrix is `fixtures/phase-0/supported-scenarios.csv`.

## Supported with deterministic suggestion

- Known recurring SaaS subscription.
- Bank fee.
- Payment-processor fee when source evidence is explicit.
- Exact repeated merchant/category rule within one entity.
- Exact duplicate and exact file re-import detection.

## Supported with founder review

- Unknown merchant.
- Business versus personal purpose.
- Client or employee reimbursement.
- Owner-paid business expense.
- Cash withdrawal.
- Ambiguous Amazon, Google, Apple, PayPal, UPI, or generic narration.

## Supported with accountant review

- Potential fixed asset.
- Owner capital or drawings.
- Customer advance.
- Security deposit.
- Loan receipt or repayment split.
- GST/TDS treatment.
- Prepaid or accrued treatment.
- Related-party activity.

## Supported later through relationship/reconciliation phases

- Internal transfer matching.
- Stripe/Razorpay settlement decomposition.
- Refund, dispute, and chargeback linkage.
- Split payouts and timing differences.

## Explicitly unsupported in the opening product

- Payroll posting.
- Inventory valuation.
- Depreciation automation.
- Complex accrual accounting.
- Multi-entity consolidation.
- Complex foreign exchange accounting.
- Tax filing.
- Autonomous final journal posting.

## Default rule

A case absent from the matrix is `unsupported_pending_policy`, not silently treated as an ordinary expense or income item.
