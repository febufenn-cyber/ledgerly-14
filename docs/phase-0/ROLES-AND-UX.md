# Roles, approvals, and review UX

## Authority boundaries

### Founder reviewer

Provides business purpose: business/personal, item purchased, project/client, reimbursement status, recurring nature, and whether a movement is an internal transfer.

### Accountant reviewer

Decides capitalization, chart-of-account policy, GST/TDS treatment, principal versus interest, prepaid/accrued handling, related-party treatment, and period-end adjustments.

### Ledgerly

Normalizes evidence, detects duplicates and recurrence, applies explicit rules, proposes relationships, performs arithmetic checks, aggregates evidence, and routes uncertainty.

## Roles

- `owner`
- `admin`
- `founder_reviewer`
- `accountant_reviewer`
- `read_only_auditor`

Permissions are explicit. Administrative access does not silently grant authority to approve accounting policy.

## Primary user experience

The core screen is the exception queue, not an analytics dashboard.

Queue groups include:

- business or personal;
- transfer candidate;
- refund/reversal;
- missing evidence;
- new merchant;
- possible fixed asset;
- split transaction;
- owner/loan/tax ambiguity;
- settlement mismatch;
- duplicate candidate.

## Interaction requirements

- Original source description remains visible.
- Similar history and rule explanation are shown.
- Users can approve one, approve a group, correct, or route to accountant.
- Group action previews affected rows.
- Undo is available before period lock.
- Unresolved items cannot be hidden by report generation.

## Period state machine

`open → reviewing → founder_approved → accountant_reviewed → export_ready → exported → locked`

Reopening a locked period requires reason, authorization, and audit event.
