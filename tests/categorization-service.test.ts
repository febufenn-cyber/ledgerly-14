import { describe, expect, it } from 'vitest'
import type {
  CategorizationCandidate,
  CategorizationRule,
  CorrectionRequest,
  RulePredicate,
  RuleSuggestion
} from '../src/domain/categorization-types'
import { CategorizationService, type CategorizationRepositoryPort } from '../src/domain/categorization-service'

class FakeRepository implements CategorizationRepositoryPort {
  readonly stored: RuleSuggestion[][] = []
  readonly corrections: Array<{ request: CorrectionRequest; predicate: RulePredicate | null }> = []

  constructor(
    private readonly candidates: CategorizationCandidate[],
    private readonly rules: CategorizationRule[]
  ) {}

  async listCandidates(): Promise<CategorizationCandidate[]> {
    return this.candidates
  }

  async listActiveRules(): Promise<CategorizationRule[]> {
    return this.rules
  }

  async storeSuggestions(_organizationId: string, suggestions: RuleSuggestion[]): Promise<unknown> {
    this.stored.push(suggestions)
    return { inserted: suggestions.length }
  }

  async getTransaction(_organizationId: string, transactionId: string): Promise<CategorizationCandidate> {
    const candidate = this.candidates.find((item) => item.id === transactionId)
    if (!candidate) throw new Error('missing')
    return candidate
  }

  async recordCorrection(input: { request: CorrectionRequest; predicate: RulePredicate | null }): Promise<unknown> {
    this.corrections.push(input)
    return { ok: true }
  }
}

const candidate: CategorizationCandidate = {
  id: 'txn-1', organizationId: 'org-1', financialAccountId: 'account-1', postedDate: '2026-07-01',
  descriptionOriginal: 'BANK SERVICE CHARGE', descriptionNormalized: 'Bank Service Charge', amountMinor: 5900,
  currency: 'INR', direction: 'debit', externalReference: null, counterpartyRaw: 'Bank'
}

const rule: CategorizationRule = {
  id: 'rule-1', organization_id: 'org-1', name: 'Bank fees', scope: 'exact_description',
  predicate_json: { descriptionEquals: 'Bank Service Charge' },
  canonical_category_code: 'expense.bank_charges', organization_category_mapping_id: null,
  priority: 900, specificity: 1, source_role: 'founder', status: 'active', version: 1,
  created_by: 'user-1', approved_by: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z'
}

describe('categorization service', () => {
  it('evaluates and persists deterministic suggestions', async () => {
    const repository = new FakeRepository([candidate], [rule])
    const result = await new CategorizationService(repository).runRules('org-1')
    expect(result).toMatchObject({ evaluated: 1, suggested: 1, conflicts: 0, unresolved: 0 })
    expect(repository.stored[0]?.[0]?.canonicalCategoryCode).toBe('expense.bank_charges')
  })

  it('builds correction predicates before persistence', async () => {
    const repository = new FakeRepository([candidate], [rule])
    await new CategorizationService(repository).correct({
      organizationId: 'org-1', transactionId: 'txn-1', canonicalCategoryCode: 'expense.bank_charges',
      organizationCategoryMappingId: null, scope: 'exact_description', reason: 'Confirmed bank charge'
    })
    expect(repository.corrections[0]?.predicate).toEqual({
      direction: 'debit', currency: 'INR', descriptionEquals: 'Bank Service Charge'
    })
  })
})
