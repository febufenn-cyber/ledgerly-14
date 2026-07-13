import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/202607130001_phase1_ingestion.sql', 'utf8')

const tenantTables = [
  'organizations',
  'organization_members',
  'financial_accounts',
  'imports',
  'import_files',
  'mapping_profiles',
  'import_attempts',
  'raw_rows',
  'normalized_transaction_staging',
  'row_issues',
  'normalized_transactions',
  'audit_events'
]

describe('Phase 1 migration guardrails', () => {
  it.each(tenantTables)('enables RLS on %s', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security;`)
  })

  it('defines transactional stage and commit functions with a fixed search path', () => {
    expect(sql).toMatch(/function public\.stage_import_attempt[\s\S]+security definer[\s\S]+set search_path = public/)
    expect(sql).toMatch(/function public\.commit_import_attempt[\s\S]+security definer[\s\S]+set search_path = public/)
  })

  it('protects strong identities without treating fuzzy similarity as unique', () => {
    expect(sql).toContain('normalized_transactions_strong_identity_unique')
    expect(sql).toContain('normalized_transactions_candidate_lookup')
    expect(sql).not.toMatch(/create\s+unique\s+index[^;]*candidate_similarity_key/i)
  })

  it('does not reference a service-role credential', () => {
    expect(sql.toLowerCase()).not.toContain('service_role')
  })
})
