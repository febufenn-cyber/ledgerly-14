# Phase 0 evaluation scaffold

Run:

```bash
python3 scripts/validate_phase0.py
```

The current validator checks artifact and contract integrity. It is deliberately dependency-free so it can run immediately.

Before an AI classifier enters a pilot, extend this directory with:

- at least 100 independently reviewed cases;
- per-class precision and escalation metrics;
- prompt-injection behavioral tests;
- entity-isolation tests;
- re-import/idempotency tests;
- transfer and settlement reconciliation tests;
- frozen model/prompt comparison reports.

Do not replace the frozen corpus when a model performs poorly. Append cases and preserve prior expected outcomes unless an accountant-reviewed policy decision changes them.
