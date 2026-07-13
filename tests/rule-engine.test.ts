import { describe, expect, it } from 'vitest'
import type { CategorizationCandidate, CategorizationRule } from '../src/domain/categorization-types'
import { buildRecurrenceKey, evaluateRules, ruleMatches } from '../src/domain/rule-engine'

const candidate: CategorizationCandidate = {
  id: 'txn-1',
  organizationId: 'org-1',
  financialAccountId: 'account-1',
  postedDate: '2026-07-01',
  descriptionOriginal: 'FIGMA MONTHLY',
  descriptionNormalized: 'Figma Monthly',
  amountMinor: 120000,
  currency: 'INR',
  direction: 'debit',
  externalReference: null,
  counterpartyRaw: 'Figma'
}

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    organization_id: 'org-1',
    name: 'Figma software',
    scope: 'exact_description',
    predicate_json: { descriptionEquals: 'figma monthly', direction: 'debit', currency: 'INR' },
    canonical_category_code: 'expense.software_subscription',
    organization_category_mapping_id: null,
    priority: 900,
    specificity: 3,
    source_role: 'founder',
    status: 'active',
    version: 1,
    created_by: 'user-1',
    approved_by: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides
  }
}

describe('deterministic categorization rules', () => {
  it('matches normalized exact descriptions without changing source text', () => {
    expect(ruleMatches(rule(), candidate)).toBe(true)
    expect(candidate.descriptionOriginal).toBe('FIGMA MONTHLY')
  })

  it('matches merchant amount ranges inclusively', () => {
    expect(
      ruleMatches(
        rule({
          scope: 'merchant_amount_range',
          predicate_json: { counterpartyEquals: 'FIGMA', minAmountMinor: 100000, maxAmountMinor: 130000 }
        }),
        candidate
      )
    ).toBe(true)
  })

  it('builds stable recurrence keys without embedding the amount', () => {
    expect(buildRecurrenceKey(candidate)).toBe('figma|debit|INR')
  })

  it('prefers an accountant rule over a conflicting founder rule', () => {
    const result = evaluateRules(candidate, [
      rule(),
      rule({
        id: 'rule-accountant',
        source_role: 'accountant',
        canonical_category_code: 'expense.professional_fees'
      })
    ])
    expect(result.status).toBe('suggested')
    expect(result.canonicalCategoryCode).toBe('expense.professional_fees')
    expect(result.sourceRuleId).toBe('rule-accountant')
  })

  it('uses specificity before explicit priority within the same source role', () => {
    const result = evaluateRules(candidate, [
      rule({ id: 'broad', scope: 'merchant_entity_future', predicate_json: { counterpartyEquals: 'Figma' }, specificity: 1, priority: 1000 }),
      rule({ id: 'specific', specificity: 3, priority: 900 })
    ])
    expect(result.sourceRuleId).toBe('specific')
  })

  it('returns a conflict when equally ranked rules disagree', () => {
    const result = evaluateRules(candidate, [
      rule({ id: 'one' }),
      rule({ id: 'two', canonical_category_code: 'expense.professional_fees' })
    ])
    expect(result.status).toBe('conflict')
    expect(result.canonicalCategoryCode).toBeNull()
    expect(result.alternatives).toEqual(['expense.professional_fees', 'expense.software_subscription'])
  })

  it('routes high-risk categories for accountant review', () => {
    const result = evaluateRules(candidate, [rule({ canonical_category_code: 'asset.computer_equipment' })])
    expect(result.requiresAccountantReview).toBe(true)
    expect(result.requiresFounderReview).toBe(true)
  })

  it('returns an unresolved decision when no active rule matches', () => {
    const result = evaluateRules(candidate, [rule({ status: 'disabled' })])
    expect(result.status).toBe('unresolved')
    expect(result.evidence).toEqual([])
  })
})
