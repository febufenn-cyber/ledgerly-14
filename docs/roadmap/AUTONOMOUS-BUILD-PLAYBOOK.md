# Ledgerly Remaining-Phase Autonomous Build Playbook

## Purpose

This playbook is the controlling implementation plan for Ledgerly Phases 3–9. It exists so a future `BUILD` instruction can execute the next incomplete phase in one continuous workflow without improvising the product boundary, weakening the accounting constitution, or merging unverified code.

The machine-readable companion is [`roadmap/remaining-phases.json`](../../roadmap/remaining-phases.json). Run:

```bash
python3 scripts/validate_build_plan.py
```

before beginning any remaining phase.

## Remaining count

Phases 0, 1, and 2 are implemented in the repository. **Seven phases remain:**

| Phase | Name | Primary outcome |
|---:|---|---|
| 3 | Structured AI ambiguity engine | Evidence-bound suggestions for cases deterministic rules cannot resolve |
| 4 | Exception-review cockpit | Fast, safe founder/accountant review experience |
| 5 | Relationship graph and reconciliation | Transfers, processor settlements, fees, refunds, and payouts tied without double-counting |
| 6 | Month-end close and journal drafts | Period readiness, close package, balanced drafts, and locked periods |
| 7 | Safe exports and integrations | Idempotent accountant, Zoho Books, Tally, and later international exports |
| 8 | Pilot hardening and operational readiness | Privacy-safe telemetry, reliability, support tools, and pilot infrastructure |
| 9 | Controlled autonomy | Entity-authorized, transaction-class-specific automation with shadow mode and kill switches |

## Meaning of `BUILD`

When the user says **`BUILD`**, execute the next phase whose `repository_status` is not `implemented`.

When the user says **`BUILD PHASE N`**, execute Phase N only after verifying all repository dependencies are complete.

A build is performed in the current interaction. It is not background work and does not promise later delivery.

A successful build includes all of the following:

1. Read the latest `main`, `AGENTS.md`, the accounting constitution, this playbook, and the machine-readable roadmap.
2. Run the roadmap validator and all currently available project checks.
3. Verify that the previous phase commits are present on `main` and no conflicting open PR changes the same contracts.
4. Create or update the phase-specific specification, API/data contracts, threat analysis, evaluation plan, and go/no-go document before implementation code is merged.
5. Implement the phase as ordered, dependency-safe PR slices.
6. For every slice: inspect the diff, run type checking and tests, push the branch, open a PR, wait for required CI, fix failures, and merge only when green.
7. Use squash merges unless repository policy changes.
8. Update the roadmap status only in the final slice of the phase.
9. Verify the final merge commit is the latest relevant commit on `main`.
10. Confirm the merged PRs, commit SHAs, checks, implemented boundary, and any production-only external gates.

## Non-negotiable merge protocol

- Never merge a red, cancelled, or missing required check.
- Never push implementation directly to `main`; use `agent/phaseN-<slice>` branches and PRs.
- Never silently include unrelated repository changes.
- Never weaken Phase 0 invariants to make a test pass.
- Never claim an external pilot, accountant sign-off, live credential test, or production deployment occurred unless it actually occurred.
- Repository implementation may be complete while production activation remains blocked.
- If CI fails, inspect the failing step or logs, patch the same branch, rerun, and merge only after success.
- If a provider credential or external human is unavailable, implement and test the contract with fakes/fixtures, leave the external gate open, and report it honestly.

## Standard phase PR sequence

Each phase should normally land through these categories of slices. Adjacent slices may be combined only when the resulting PR remains reviewable.

1. **Specification and contracts** — phase spec, ADRs, schemas, threat model, fixtures, and go/no-go gates.
2. **Persistence and authorization** — migrations, RLS, immutable history, RPCs, and cross-tenant guardrails.
3. **Domain engine** — deterministic or model-backed business logic with unit and property tests.
4. **API and user workflow** — authenticated endpoints, queue/state transitions, and UI where applicable.
5. **Hardening and completion** — observability, load/failure tests, documentation, roadmap status, and final gate review.

## Required evidence in the final confirmation

For every built phase, report:

- phase name and implemented scope;
- PR numbers and links;
- main-branch merge SHAs in order;
- CI workflow and successful job evidence;
- latest `main` verification;
- automated test count where available;
- migrations added;
- API/UI surfaces added;
- security and accounting invariants enforced;
- production activation gates still open.

---

# Phase 3 — Structured AI Ambiguity Engine

## Objective

Add a provider-neutral reasoning service for transactions that deterministic rules leave unresolved or conflicting. The model proposes structured classifications and questions; it never approves, posts, or mutates locked accounting records.

## Prerequisites

- Phases 0–2 are merged.
- Phase 2 migrations and RLS policies have a non-production verification path.
- Canonical category and account-mapping contracts remain the source of allowed output values.
- A frozen labeled corpus exists; repository fixtures may be synthetic, while accountant-reviewed production activation remains an external gate.

## Planned slices

### 3A — Specification, model contracts, and evaluation corpus

- `docs/phase-3/PHASE-3-SPEC.md`, API contract, threat model, and go/no-go checklist.
- Provider-neutral `ModelAdapter` interface.
- Strict input envelope containing transaction evidence, organization context allowed by policy, candidate categories, and deterministic-rule outcome.
- Strict output schema: suggested category, alternatives, evidence references, reason codes, confidence band, founder question, accountant-review flag, and refusal/insufficient-evidence state.
- Prompt/template versioning and immutable fixture expectations.
- Prompt-injection, hallucinated-evidence, unsupported-category, malformed-output, timeout, and provider-error fixtures.

### 3B — Persistence, privacy, and policy gates

- Model-run, prompt-version, output, cost/usage, and evaluation tables with organization RLS.
- Redaction/minimization layer before provider calls.
- Imported descriptions and receipt text represented only as untrusted data fields.
- Per-organization model feature flag, budgets, timeouts, retry limits, and circuit breaker.
- Policy gate that rejects categories outside the canonical map, fabricated evidence references, invalid confidence, and unsafe high-risk routing.

### 3C — Suggestion service and queue integration

- Execute only for unresolved/conflicting transactions selected by policy.
- Cache/idempotency by transaction evidence version + model/prompt/policy version.
- Store model output as `suggested`; never `approved`.
- Fall back to unresolved on provider or validation failure.
- Integrate model suggestions into the existing categorization queue without hiding deterministic conflicts.

### 3D — Evaluation, regression, and API

- Batch evaluation harness with per-class precision, escalation recall, schema-validity, latency, and cost metrics.
- Compare model/prompt versions against a frozen baseline.
- API endpoints for controlled runs, run status, evidence display, and model diagnostics without raw sensitive logging.
- CI blocks regressions in safety-critical metrics.

## Acceptance gates

- 100% schema-valid persisted suggestions.
- 100% referenced evidence exists in the authorized transaction evidence set.
- Prompt-injection fixtures cannot alter instructions or invoke actions.
- Provider failure leaves the transaction unresolved and preserves prior decisions.
- No model output directly approves a transaction or creates a future rule.
- High-confidence precision target is at least 98% on the reviewed frozen corpus before production activation.
- Unsupported/high-risk escalation recall target is at least 99% before production activation.

## External production gates

- Provider credentials configured outside the repository.
- Accountant review of the frozen corpus and thresholds.
- Privacy/retention review for the selected provider.
- Cost and latency approval in a non-production environment.

---

# Phase 4 — Exception-Review Cockpit

## Objective

Create the primary product experience: a fast, accessible queue where founders supply business context and accountants resolve policy-sensitive cases without losing source evidence.

## Planned slices

### 4A — Queue and grouping contracts

- Stable queue reasons, filters, pagination/cursors, sorting, and role visibility.
- Grouping engine for exact recurring series, same merchant/rule outcome, and shared ambiguity reason.
- Group actions preview affected transactions and reject mixed-risk unsafe groups.
- Review sessions and optimistic-concurrency/version checks.

### 4B — Web application foundation

- Production-grade responsive web UI integrated with the Hono/Supabase backend.
- Authentication, organization/account context, source evidence drawer, suggestion explanation, alternatives, and unresolved state.
- Keyboard navigation, focus management, screen-reader labels, and non-colour-only status indicators.

### 4C — Review actions and undo

- Approve, correct, route to accountant, leave unresolved, and create explicitly scoped rules.
- Batch action confirmation with full impact preview.
- Reversible actions before period lock and append-only audit history.
- Collision handling when another reviewer changes the same transaction.

### 4D — Usability, performance, and end-to-end tests

- Synthetic 100/1,000-transaction review sessions.
- Browser end-to-end tests for founder and accountant roles.
- No hidden unresolved items; queue counts reconcile to transaction states.
- Performance budgets and privacy-safe UX telemetry.

## Acceptance gates

- Every queue item shows original evidence, current decision, suggestion source, and why review is required.
- Group actions cannot cross organizations, categories, risk boundaries, or stale versions.
- No unresolved item disappears because a filter, group, or report was generated.
- Undo restores the prior current decision while preserving audit history.
- External usability target: an in-scope founder reviews 100 ordinary transactions within 10–15 minutes.

## External production gates

- Two founder usability walkthroughs.
- Accountant workflow review.
- Accessibility review with real keyboard and assistive-technology checks.

---

# Phase 5 — Relationship Graph and Reconciliation

## Objective

Model the real financial relationships behind flat bank rows so transfers, Stripe/Razorpay settlements, fees, refunds, disputes, and payouts reconcile without double-counting revenue or expenses.

## Planned slices

### 5A — Financial-event graph persistence

- `financial_events`, `transaction_components`, `transaction_relationships`, `settlements`, and `reconciliation_runs`.
- Typed relationships such as `transfer_to`, `settles`, `fee_for`, `refund_of`, `reversal_of`, and `payout_contains`.
- Immutable source links, RLS, append-only relationship decisions, and conflict states.

### 5B — Internal-transfer matcher

- Exact and candidate matching across organization accounts using amount, direction, dates, references, and configurable timing windows.
- Fees and timing differences remain explicit.
- No transfer candidate automatically becomes income or expense.

### 5C — Stripe and Razorpay source adapters

- CSV-first processor adapters with immutable raw evidence.
- Components for charges, fees, refunds, disputes, adjustments, and net payouts.
- Payout-to-bank matching and missing-component detection.
- Live APIs are optional later connectors and require separate credential gates.

### 5D — Reconciliation engine and exception queue

- Reconciliation arithmetic, tolerances only where policy permits, and zero-difference proof.
- Unmatched, partially matched, duplicate, and timing-difference queues.
- Graph explanation API and UI showing every component and source link.

## Acceptance gates

- Internal transfers do not create income or expense.
- Processor revenue is not double-counted between processor and bank feeds.
- Exact settlement fixtures reconcile to zero.
- Missing components create visible differences; the system never invents plugs.
- Every relationship traces to source evidence and a rule/human/system decision.
- Re-running reconciliation is idempotent and does not duplicate relationships.

## External production gates

- Permissioned samples covering Stripe and Razorpay settlement variants.
- Accountant review of fee/refund/dispute treatment.
- Live provider credentials only after CSV behavior is stable.

---

# Phase 6 — Month-End Close and Journal Drafts

## Objective

Turn reviewed and reconciled transactions into a controlled period-close workflow, accountant-ready package, and balanced journal drafts without automatic final posting.

## Planned slices

### 6A — Period and close state machine

- `close_periods`, reviewers, blockers, checklists, reopening events, and period locks.
- States: open, reviewing, founder-approved, accountant-reviewed, export-ready, exported, locked.
- Database enforcement that locked periods reject silent edits and rule/model reapplication.

### 6B — Readiness and close checks

- Reconciliation completeness, unresolved transaction counts, missing evidence, high-risk review, unusual transactions, and duplicate warnings.
- Explicit blocking versus advisory checks.
- Snapshot/version of all inputs used for readiness.

### 6C — Close package and reports

- Cash movement, draft profit-and-loss category summary, owner/personal items, new merchants, potential assets, tax-review items, missing receipts, and change history.
- JSON/CSV first, with printable presentation only after data contracts are stable.

### 6D — Balanced journal drafts

- Journal headers and lines linked to source transactions/components.
- Database constraint/RPC enforcement that total debits equal total credits.
- Approval, rejection, supersession, and audit history.
- No direct posting to an accounting system in this phase.

## Acceptance gates

- It is structurally impossible to approve or export an unbalanced journal draft.
- Every journal line traces to authorized source evidence.
- A locked period cannot change without an explicit reopening event and reason.
- Readiness cannot be green while blocking unresolved or unreconciled items exist.
- Regenerating a package from the same snapshot is deterministic.

## External production gates

- Accountant review of close package and draft journal representation.
- Three representative month-end fixture sets.
- Legal/product review of language so drafts are not represented as final advice.

---

# Phase 7 — Safe Exports and Integrations

## Objective

Export only approved, reconciled, period-bound work through previewable and idempotent manifests, prioritizing accountant CSV/Excel, Zoho Books, and Tally for the opening India-first segment.

## Planned slices

### 7A — Export contracts and idempotency

- Export profiles, destination account/tax mappings, dry runs, manifests, status machine, destination references, retries, and cancellation.
- Idempotency key derived from organization + period snapshot + destination + export profile version.
- No export from an unlocked/unapproved period unless explicitly allowed for a draft format.

### 7B — Accountant package formats

- Safe CSV and XLSX generation with formula-injection protection.
- Human-readable manifest and rejected/missing-mapping report.
- Round-trip fixture validation.

### 7C — Zoho Books and Tally formats

- Zoho Books-compatible import/API adapter behind credential abstraction.
- Tally-compatible XML/CSV format with deterministic ledger mappings.
- Dry-run validation before outbound calls or downloadable final files.

### 7D — Optional international connectors

- Xero and QuickBooks only for supported target markets and current APIs.
- OAuth/token storage, least-privilege scopes, revocation, and connector-specific idempotency.
- Connector failures do not mutate Ledgerly approval state.

## Acceptance gates

- Retrying the same export cannot create duplicate destination entries.
- Every export has a permanent manifest, profile version, source snapshot, actor, and destination identifiers.
- Missing mappings block final export and remain visible.
- Spreadsheet exports neutralize formula execution while preserving source text.
- Dry-run output exactly identifies what will be sent or generated.

## External production gates

- Current provider API review at implementation time.
- Sandbox credentials and round-trip tests for each live connector.
- Accountant validation of Zoho/Tally mappings.

---

# Phase 8 — Pilot Hardening and Operational Readiness

## Objective

Make Ledgerly supportable, observable, privacy-operable, resilient, and measurable for controlled pilots. Repository implementation cannot itself complete real customer pilots; external outcomes remain explicit gates.

## Planned slices

### 8A — Privacy-safe observability

- Metrics for imports, suggestions, corrections, review time, reconciliation, close readiness, and exports without raw financial text.
- Trace correlation through IDs, structured error codes, dashboards, and alerts.
- Model/provider cost telemetry where applicable.

### 8B — Privacy and account operations

- Data export, deletion request workflow, retention policies, credential revocation, membership removal, and audit access.
- Backup/restore documentation and destructive-operation safeguards.

### 8C — Reliability and security hardening

- Load, failure-injection, retry, concurrency, RLS, authorization, rate-limit, and secret-scanning tests.
- Runbooks for provider outage, stuck import, reconciliation mismatch, export failure, suspected tenant leak, and rollback.
- Feature flags and staged rollout controls.

### 8D — Pilot operations tooling

- Pilot enrollment, organization eligibility, support notes with strict access controls, feedback capture, issue linkage, and success-metric reports.
- Cohort dashboards for close cycles without exposing transaction descriptions.

## Acceptance gates

- Operational logs contain no prohibited raw financial data in tested paths.
- Cross-tenant and role matrices pass in a live non-production environment.
- Failure injection creates no partial active financial state.
- Deletion/export workflows have testable manifests and audit records.
- Runbooks identify owner, detection, containment, recovery, and verification steps.

## External production gates

- Five in-scope businesses and one or two accounting partners.
- Three consecutive close cycles.
- Measured founder review time, accountant review time, correction rate, reconciliation differences, export failures, and retention.
- Security/privacy review and incident-response rehearsal.

The build process must report Phase 8 repository completion separately from external pilot completion.

---

# Phase 9 — Controlled Autonomy

## Objective

Allow narrowly defined, low-risk transaction classes to move from suggestion to automatic approval only after verified entity history, explicit consent, shadow-mode evidence, calibrated performance, and immediate revocation controls.

## Planned slices

### 9A — Automation policy persistence

- Entity-level automation policies per transaction class/category/rule.
- Eligibility history, consent, effective dates, limits, revocation, and audit events.
- No global autopilot flag.

### 9B — Eligibility engine

- Minimum accepted-history count, no recent corrections, stable merchant/amount pattern, low-risk category, no conflicts, no unusual deviation, and calibrated precision requirements.
- Owner, personal, loan, fixed-asset, statutory/tax, related-party, and complex-FX classes are ineligible.

### 9C — Shadow mode and simulation

- Run would-be automatic decisions without changing accounting state.
- Compare against subsequent human decisions.
- Per-class precision, correction, drift, and abstention reports.

### 9D — Controlled activation and monitoring

- Explicit organization opt-in per eligible class.
- Limits by count/value/time window, immediate kill switch, rollback/supersession workflow, and alerts on drift or correction.
- Automatic suspension after threshold breach, policy/model/rule change, or anomalous activity.

## Acceptance gates

- There is no global autopilot; autonomy is granted per entity and transaction class.
- High-risk categories are never automation-eligible.
- Every automated decision records the policy, rule/model versions, evidence, eligibility calculation, and consent.
- Shadow-mode performance meets the configured threshold before activation.
- A kill switch stops new automatic decisions immediately without deleting history.
- Any correction to an automated class triggers review or suspension according to policy.

## External production gates

- Accountant-approved automation classes.
- Sufficient live accepted history for each entity/class.
- Shadow-mode observation across multiple close cycles.
- Explicit customer consent and clear reversal/support process.

---

# Completion definition

Ledgerly’s repository roadmap is complete when Phases 3–9 have `repository_status: implemented`, every phase’s CI and merge evidence is present on `main`, and the final roadmap validator passes.

Product readiness is a separate claim. Production activation additionally requires the external gates documented per phase, especially accountant review, permissioned real data, live RLS/security verification, provider sandbox tests, pilots, and shadow-mode evidence.
