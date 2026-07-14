# Phase 3 go/no-go

## Repository gate

- [ ] Strict input and output contracts committed.
- [ ] Prompt-injection, fabricated-evidence, malformed-output, timeout, and provider-error fixtures pass.
- [ ] Model-run persistence and RLS committed.
- [ ] Feature, budget, timeout, retry, and circuit-breaker policy enforced.
- [ ] Provider-neutral service persists suggestions only.
- [ ] Invalid or failed output leaves transactions unresolved.
- [ ] Authenticated API and diagnostics committed.
- [ ] Evaluation and regression checks run in CI.
- [ ] Roadmap marks Phase 3 implemented only in the final green PR.

## Production activation gate

- [ ] Provider credentials configured outside Git.
- [ ] Selected provider privacy, retention, and regional-processing terms reviewed.
- [ ] Frozen corpus independently reviewed by an accountant.
- [ ] High-confidence precision is at least 98% on the reviewed corpus.
- [ ] Unsupported and high-risk escalation recall is at least 99%.
- [ ] Non-production cost, latency, rate-limit, and failure behavior accepted.
- [ ] Live cross-tenant RLS tests pass.

## Decision

Repository implementation may be complete while production remains **NO-GO**. Provider-backed execution must remain disabled until every production activation gate is evidenced.
