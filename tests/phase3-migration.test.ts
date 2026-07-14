import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('../supabase/migrations/202607140001_phase3_ai.sql', import.meta.url),
  'utf8'
)

describe('Phase 3 AI migration guardrails', () => {
  it('creates entity-scoped policy, run, and suggestion tables with RLS', () => {
    for (const token of [
      'create table if not exists public.organization_ai_policies',
      'create table if not exists public.ai_model_runs',
      'create table if not exists public.ai_suggestions',
      'alter table public.organization_ai_policies enable row level security',
      'alter table public.ai_model_runs enable row level security',
      'alter table public.ai_suggestions enable row level security'
    ]) expect(sql).toContain(token)
  })

  it('defaults to disabled and requires explicit role-checked configuration', () => {
    expect(sql).toContain("enabled boolean not null default false")
    expect(sql).toContain("public.has_org_role(p_organization_id, array['owner','admin'])")
    expect(sql).toContain('create or replace function public.configure_ai_policy')
  })

  it('enforces budget, circuit, eligibility, and idempotency before a call', () => {
    expect(sql).toContain("if v_policy.circuit_state = 'open'")
    expect(sql).toContain("raise exception 'AI_BUDGET_EXHAUSTED'")
    expect(sql).toContain("status in ('unresolved','conflict')")
    expect(sql).toContain('unique (organization_id, idempotency_key)')
  })

  it('keeps model output suggestion-only and evidence-bound', () => {
    expect(sql).toContain("raise exception 'AI_OUTPUT_CANNOT_APPROVE'")
    expect(sql).toContain("raise exception 'AI_CATEGORY_NOT_ALLOWED'")
    expect(sql).toContain("raise exception 'AI_EVIDENCE_NOT_AUTHORIZED'")
    expect(sql).toContain("raise exception 'AI_HIGH_RISK_REQUIRES_ACCOUNTANT'")
    expect(sql).not.toContain("status = 'approved'")
  })

  it('stores AI suggestions separately from human classification decisions', () => {
    expect(sql).toContain('create table if not exists public.ai_suggestions')
    expect(sql).not.toContain("decision_source = 'ai'")
    expect(sql).toContain('AI ambiguity run completed without approval authority')
  })
})
