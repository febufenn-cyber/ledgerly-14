# Canonical transaction ontology

A bank row is evidence of money movement, not a complete accounting event. Ledgerly separates the following concepts.

## Raw source row

Immutable representation of the imported row, including file fingerprint, row number, original text, original amount representation, source account, and import timestamp.

## Normalized transaction

Standard representation of the movement: integer minor-unit amount, currency, direction, dates, normalized counterparty, source references, fingerprint, and processing state.

## Financial event

The real-world event inferred from evidence, such as customer payment, processor fee, payout, refund, transfer, or owner contribution.

## Transaction component

Accounting component belonging to an event. A processor payout can contain revenue settlement, fees, refunds, disputes, and the resulting bank deposit.

## Relationship

Typed link between evidence and events:

- `refund_of`
- `reversal_of`
- `duplicate_of`
- `transfer_to`
- `fee_for`
- `settles`
- `payout_contains`
- `reimburses`

## Classification decision

A suggestion or approved interpretation containing canonical category, mapped customer account, evidence, alternatives, confidence band, review requirements, actor, and version.

## Audit event

Append-only record of a consequential state transition.

## Core invariants

- `amount_minor` is an integer and non-negative; direction carries debit/credit semantics.
- Currency is ISO 4217 uppercase.
- Source fields remain unchanged.
- A source row can map to zero, one, or multiple components, but mappings are explicit.
- Relationships are typed and cannot imply accounting treatment without a classification decision.
- Organization identity is present on every tenant-owned record.

The executable contracts live in `schemas/`.
