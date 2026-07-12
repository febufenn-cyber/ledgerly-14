#!/usr/bin/env python3
"""Dependency-free integrity checks for Ledgerly Phase 0 artifacts."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_DISPOSITIONS = {
    "suggest",
    "ask_founder",
    "ask_accountant",
    "defer_to_reconciliation",
    "transfer_candidate",
    "duplicate_candidate",
    "link_refund",
    "unsupported",
}
ALLOWED_RISKS = {"low", "medium", "high"}
ALLOWED_CONFIDENCE = {"unknown", "low", "medium", "high", "automation_eligible"}


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Invalid JSON {path.relative_to(ROOT)}: {exc}")


def validate_manifest() -> None:
    manifest = load_json(ROOT / "phase-0-manifest.json")
    if manifest.get("phase") != "0":
        fail("Manifest phase must be '0'")
    missing = [p for p in manifest.get("required_files", []) if not (ROOT / p).is_file()]
    if missing:
        fail(f"Missing required Phase 0 files: {', '.join(missing)}")


def validate_schemas() -> None:
    transaction = load_json(ROOT / "schemas/transaction.schema.json")
    amount = transaction["properties"].get("amount_minor", {})
    if amount.get("type") != "integer" or amount.get("minimum") != 0:
        fail("transaction.amount_minor must be a non-negative integer")

    for name in ("classification-decision.schema.json", "audit-event.schema.json"):
        schema = load_json(ROOT / "schemas" / name)
        if schema.get("type") != "object" or not schema.get("required"):
            fail(f"{name} must define an object with required fields")


def validate_categories() -> set[str]:
    data = load_json(ROOT / "schemas/canonical-categories.json")
    categories = data.get("categories", [])
    codes = [item.get("code") for item in categories]
    if not codes or any(not code for code in codes):
        fail("Canonical categories must have non-empty codes")
    if len(codes) != len(set(codes)):
        fail("Canonical category codes must be unique")
    for item in categories:
        if item.get("risk") not in ALLOWED_RISKS:
            fail(f"Invalid category risk: {item}")
    return set(codes)


def validate_bank_fixture() -> set[str]:
    path = ROOT / "fixtures/phase-0/bank-edge-cases.csv"
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    ids = [row["source_row_id"] for row in rows]
    if len(ids) != len(set(ids)):
        fail("Bank fixture source_row_id values must be unique")
    for row in rows:
        try:
            amount = int(row["amount_minor"])
        except ValueError:
            fail(f"Non-integer amount_minor in {row['source_row_id']}")
        if amount < 0:
            fail(f"Negative amount_minor in {row['source_row_id']}")
        if row["direction"] not in {"debit", "credit"}:
            fail(f"Invalid direction in {row['source_row_id']}")
    return set(ids)


def validate_expected_results(source_ids: set[str], category_codes: set[str]) -> None:
    path = ROOT / "fixtures/phase-0/expected-results.jsonl"
    cases: list[dict] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as exc:
            fail(f"Invalid JSONL at line {line_number}: {exc}")
    case_ids = [case.get("case_id") for case in cases]
    if len(case_ids) != len(set(case_ids)):
        fail("Expected-result case_id values must be unique")
    for case in cases:
        missing_sources = set(case.get("source_row_ids", [])) - source_ids
        if missing_sources:
            fail(f"{case['case_id']} references unknown rows: {sorted(missing_sources)}")
        if case.get("expected_disposition") not in ALLOWED_DISPOSITIONS:
            fail(f"Invalid disposition in {case['case_id']}")
        if case.get("confidence_band") not in ALLOWED_CONFIDENCE:
            fail(f"Invalid confidence band in {case['case_id']}")
        category = case.get("expected_category")
        if category is not None and category not in category_codes:
            fail(f"Unknown category {category} in {case['case_id']}")
        if not isinstance(case.get("must_not_do"), list) or not case["must_not_do"]:
            fail(f"{case['case_id']} must define at least one prohibited behavior")


def validate_scenario_matrix() -> None:
    path = ROOT / "fixtures/phase-0/supported-scenarios.csv"
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    scenario_ids = [row["scenario_id"] for row in rows]
    if len(scenario_ids) != len(set(scenario_ids)):
        fail("Scenario IDs must be unique")
    for row in rows:
        if row["disposition"] not in ALLOWED_DISPOSITIONS:
            fail(f"Invalid scenario disposition in {row['scenario_id']}")
        if row["risk"] not in ALLOWED_RISKS:
            fail(f"Invalid scenario risk in {row['scenario_id']}")
        if not row["earliest_phase"]:
            fail(f"Missing earliest_phase in {row['scenario_id']}")


def validate_constitution() -> None:
    text = (ROOT / "docs/phase-0/ACCOUNTING-CONSTITUTION.md").read_text(encoding="utf-8")
    required = [
        "Preserve source truth",
        "No silent data loss",
        "No false balancing",
        "No unbalanced journals",
        "AI is not source truth",
        "Keep uncertainty visible",
        "Protect closed periods",
        "Entity isolation is absolute",
        "Automation must be earned",
    ]
    missing = [phrase for phrase in required if phrase not in text]
    if missing:
        fail(f"Constitution is missing required principles: {', '.join(missing)}")


def main() -> int:
    try:
        validate_manifest()
        validate_schemas()
        category_codes = validate_categories()
        source_ids = validate_bank_fixture()
        validate_expected_results(source_ids, category_codes)
        validate_scenario_matrix()
        validate_constitution()
    except ValueError as exc:
        print(f"PHASE 0 VALIDATION FAILED: {exc}", file=sys.stderr)
        return 1
    print("Phase 0 validation passed: artifacts, schemas, fixtures, and policy enums are internally consistent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
