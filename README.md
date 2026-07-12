# Ledgerly

> An India-first month-end close co-pilot that turns bank and payment feeds into a reconciled, explainable, accountant-ready review package.

Ledgerly is intentionally **not** an autonomous accountant. It preserves source evidence, applies deterministic rules before AI, keeps uncertainty visible, and requires human review for high-risk accounting decisions.

## Current status

**Phase 0 — Accounting Constitution** is implemented on this branch. Phase 0 locks the product boundary, accounting invariants, transaction ontology, correction policy, confidence ladder, threat model, evaluation fixtures, and go/no-go gates before production ingestion begins.

Start here:

- [`docs/phase-0/PHASE-0-CHARTER.md`](docs/phase-0/PHASE-0-CHARTER.md)
- [`docs/phase-0/ACCOUNTING-CONSTITUTION.md`](docs/phase-0/ACCOUNTING-CONSTITUTION.md)
- [`docs/phase-0/GO-NO-GO.md`](docs/phase-0/GO-NO-GO.md)
- [`phase-0-manifest.json`](phase-0-manifest.json)

Run the Phase 0 checks:

```bash
python3 scripts/validate_phase0.py
```

## Opening customer

Indian service businesses, agencies, consultants, and small SaaS companies with:

- one legal entity;
- INR as the primary functional currency;
- no inventory-heavy accounting;
- approximately 100–1,000 monthly transactions;
- bank CSV plus Stripe or Razorpay activity;
- an existing founder reviewer and accountant/CA.

## Product promise

Ledgerly imports and normalizes transaction evidence, identifies repeated patterns, asks only for missing business context, reconciles related movements, and prepares a review package for the founder and accountant.

It does **not** file taxes, replace a CA, silently alter closed periods, invent balancing entries, or directly post uncertain AI output.

## Phased roadmap

1. **Phase 0:** Accounting constitution and risk boundaries.
2. **Phase 1:** Trustworthy CSV ingestion and normalization.
3. **Phase 2:** Deterministic rules and correction memory.
4. **Phase 3:** Structured AI ambiguity resolution.
5. **Phase 4:** Exception-review cockpit.
6. **Phase 5:** Settlement graph and reconciliation.
7. **Phase 6:** Month-end close package.
8. **Phase 7:** Safe Zoho Books, Tally, and accountant exports.
9. **Phase 8:** Paid pilots and accountant validation.
10. **Phase 9:** Controlled, transaction-class-specific autonomy.

## Architecture direction

Cloudflare Workers + Hono, Supabase Postgres/Auth/RLS, private object storage, deterministic normalization and relationship services, and a structured AI suggestion service behind accounting policy gates.

The model provider is replaceable. The durable asset is each entity’s verified accounting memory graph: source evidence, accepted decisions, accountant overrides, rules, mappings, and reconciliation relationships.
