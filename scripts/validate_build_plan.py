#!/usr/bin/env python3
"""Validate Ledgerly's machine-readable remaining-phase build plan."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "roadmap" / "remaining-phases.json"
PHASE_NUMBERS = list(range(3, 10))
REPOSITORY_STATUSES = {"planned", "in_progress", "implemented"}
PRODUCTION_STATUSES = {
    "blocked_by_external_gates",
    "eligible_for_non_production",
    "production_ready",
}
REQUIRED_LIST_FIELDS = (
    "slices",
    "preflight",
    "hard_invariants",
    "acceptance",
    "external_gates",
)


class PlanError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PlanError(message)


def load_plan() -> dict[str, Any]:
    try:
        data = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PlanError(f"Cannot read {PLAN_PATH.relative_to(ROOT)}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise PlanError(f"Invalid JSON in {PLAN_PATH.relative_to(ROOT)}: {exc}") from exc
    require(isinstance(data, dict), "Roadmap root must be an object")
    return data


def contains(items: list[str], phrase: str) -> bool:
    needle = phrase.casefold()
    return any(needle in item.casefold() for item in items)


def validate_plan(plan: dict[str, Any]) -> None:
    require(plan.get("default_branch") == "main", "default_branch must remain main")
    require(plan.get("version"), "Roadmap version is required")

    current = plan.get("current_repository_phase")
    require(isinstance(current, int) and 2 <= current <= 9, "current_repository_phase must be 2 through 9")
    require(plan.get("remaining_phase_count") == 9 - current, "remaining_phase_count must equal 9 - current_repository_phase")

    trigger = plan.get("build_trigger")
    require(isinstance(trigger, dict), "build_trigger must be an object")
    require(trigger.get("default_command") == "BUILD", "Default build command must be BUILD")
    require(trigger.get("targeted_command") == "BUILD PHASE N", "Targeted build command must be BUILD PHASE N")

    merge_policy = plan.get("merge_policy")
    require(isinstance(merge_policy, dict), "merge_policy must be an object")
    require(merge_policy.get("branch_pattern") == "agent/phaseN-<slice>", "Unexpected branch pattern")
    require(merge_policy.get("merge_method") == "squash", "Remaining phases must use squash merges")
    required_before_merge = merge_policy.get("required_before_merge")
    require(isinstance(required_before_merge, list) and len(required_before_merge) >= 5, "Merge checks are incomplete")
    require(contains(required_before_merge, "GitHub Actions"), "Merge policy must require GitHub Actions checks")

    phases = plan.get("phases")
    require(isinstance(phases, list), "phases must be a list")
    numbers = [phase.get("number") for phase in phases if isinstance(phase, dict)]
    require(numbers == PHASE_NUMBERS, f"Phases must be contiguous and ordered: {PHASE_NUMBERS}")

    slugs: set[str] = set()
    names: set[str] = set()
    in_progress: list[int] = []

    for phase in phases:
        require(isinstance(phase, dict), "Every phase entry must be an object")
        number = phase["number"]
        slug = phase.get("slug")
        name = phase.get("name")
        require(isinstance(slug, str) and slug, f"Phase {number} requires a slug")
        require(isinstance(name, str) and name, f"Phase {number} requires a name")
        require(slug not in slugs, f"Duplicate phase slug: {slug}")
        require(name not in names, f"Duplicate phase name: {name}")
        slugs.add(slug)
        names.add(name)

        status = phase.get("repository_status")
        production_status = phase.get("production_status")
        require(status in REPOSITORY_STATUSES, f"Invalid repository_status for Phase {number}")
        require(production_status in PRODUCTION_STATUSES, f"Invalid production_status for Phase {number}")

        expected_dependencies = list(range(0, number))
        require(phase.get("depends_on") == expected_dependencies, f"Phase {number} dependencies must be {expected_dependencies}")
        require(isinstance(phase.get("objective"), str) and phase["objective"], f"Phase {number} objective is required")

        for field in REQUIRED_LIST_FIELDS:
            value = phase.get(field)
            require(isinstance(value, list) and len(value) >= 3, f"Phase {number} {field} must contain at least three entries")
            require(all(isinstance(item, str) and item.strip() for item in value), f"Phase {number} {field} contains an invalid item")

        if number <= current:
            require(status == "implemented", f"Phase {number} must be implemented because current_repository_phase is {current}")
        elif status == "implemented":
            raise PlanError(f"Phase {number} cannot be implemented while current_repository_phase is {current}")
        elif status == "in_progress":
            in_progress.append(number)

    require(len(in_progress) <= 1, "Only one phase may be in progress")
    if in_progress:
        require(in_progress[0] == current + 1, "Only the next phase may be in progress")

    by_number = {phase["number"]: phase for phase in phases}
    require(contains(by_number[3]["hard_invariants"], "suggestion-only"), "Phase 3 must preserve suggestion-only AI")
    require(contains(by_number[3]["hard_invariants"], "untrusted data"), "Phase 3 must treat imported text as untrusted data")
    require(contains(by_number[5]["acceptance"], "double-counted"), "Phase 5 must test double-count prevention")
    require(contains(by_number[6]["hard_invariants"], "unbalanced journal"), "Phase 6 must prohibit unbalanced journals")
    require(contains(by_number[7]["hard_invariants"], "idempotency"), "Phase 7 must require export idempotency")
    require(contains(by_number[8]["hard_invariants"], "not represented as completed external pilots"), "Phase 8 must separate code completion from pilot completion")
    require(contains(by_number[9]["hard_invariants"], "no global autopilot"), "Phase 9 must prohibit global autopilot")
    require(contains(by_number[9]["hard_invariants"], "High-risk"), "Phase 9 must exclude high-risk classes")


def main() -> int:
    try:
        plan = load_plan()
        validate_plan(plan)
    except PlanError as exc:
        print(f"BUILD PLAN VALIDATION FAILED: {exc}", file=sys.stderr)
        return 1

    current = plan["current_repository_phase"]
    remaining = plan["remaining_phase_count"]
    next_phase = next(
        (phase for phase in plan["phases"] if phase["repository_status"] != "implemented"),
        None,
    )
    next_label = "none" if next_phase is None else f"{next_phase['number']} — {next_phase['name']}"
    print(
        "Build plan validation passed: "
        f"repository through Phase {current}, {remaining} phases remaining, next phase {next_label}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
