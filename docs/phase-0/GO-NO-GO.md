# Phase 0 go/no-go gate

Repository artifacts are implemented, but Phase 1 is not authorized until the external gates are completed.

## Scope gate

- [x] Opening customer is narrow and India-first.
- [x] Unsupported businesses and accounting domains are explicit.
- [x] Product promise avoids autonomous-accounting claims.
- [ ] Two in-scope founders confirm the pain and workflow.

## Accounting gate

- [x] High-risk transaction classes are identified.
- [x] Founder versus accountant authority is explicit.
- [x] Never-auto-approve categories are documented.
- [ ] Independent accountant/CA red-team review is completed.
- [ ] Accountant signs off or records blocking objections.

## Data and AI gate

- [x] Canonical schemas are committed.
- [x] Integer minor-unit money is mandatory.
- [x] Source immutability and audit events are mandatory.
- [x] AI output is suggestion-only and evidence-bound.
- [ ] Frozen corpus expanded to at least 100 reviewed cases before AI pilot.

## Security gate

- [x] Tenant isolation and RLS are first-migration requirements.
- [x] Imported text is classified as untrusted.
- [x] Private storage and log redaction are documented.
- [ ] Phase 1 implementation plan includes executable RLS and cross-tenant tests.

## Authorization decision

- **GO:** external review gates completed, no unresolved constitution-level defect, and Phase 1 spec explicitly implements the invariants.
- **CONDITIONAL GO:** only documentation defects remain with named owner and deadline; no accounting, security, or data-integrity blocker.
- **NO-GO:** accountant rejects the model, target customer is not validated, or any source-truth/tenant-isolation invariant is weakened.

Decision must be appended to `DECISION-LOG.md`; prior decisions are not deleted.
