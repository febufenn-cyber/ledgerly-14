import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/202607130002_phase2_categorization.sql', import.meta.url),
  'utf8'
)

describe('Phase 2 migration guardrails', () => {
  it('creates the four entity-memory layers', () => {
    expect(migration).toContain('create table if not exists public.canonical_categories')
    expect(migration).toContain('create table if not exists public.organization_category_mappings')
    expect(migration).toContain('create table if not exists public.classification_rules')
    expect(migration).toContain('create table if not exists public.classification_decisions')
    expect(migration).toContain('create table if not exists public.correction_events')
  })

  it('enables RLS for all Phase 2 customer data', () => {
    for (const table of [
      'canonical_categories',
      'organization_category_mappings',
      'classification_rules',
      'classification_decisions',
      'correction_events'
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('enforces one current decision without deleting history', () => {
    expect(migration).toContain('classification_decisions_one_current')
    expect(migration).toContain('where is_current')
    expect(migration).toContain("status = case when status in ('suggested','conflict','unresolved','approved','corrected') then 'superseded'")
  })

  it('protects approved decisions from deterministic reruns', () => {
    expect(migration).toContain("d.status in ('approved','corrected')")
    expect(migration).toContain('v_skipped := v_skipped + 1')
  })

  it('uses role-checked security-definer RPCs with fixed search paths', () => {
    for (const fn of [
      'create_classification_rule',
      'store_rule_suggestions',
      'record_categorization_correction',
      'get_categorization_queue'
    ]) {
      expect(migration).toContain(`function public.${fn}`)
    }
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(8)
    expect(migration.match(/set search_path = public/g)?.length).toBeGreaterThanOrEqual(9)
  })

  it('keeps transaction-only corrections from generating rules', () => {
    expect(migration).toContain("if p_scope <> 'transaction_only' then")
    expect(migration).toContain('generated_rule_id')
  })
})
