import { describe, expect, it } from 'vitest'
import type { CategorizationCandidate, CorrectionRequest } from '../src/domain/categorization-types'
import { buildCorrectionPlan } from '../src/domain/correction-policy'

const candidate: CategorizationCandidate = {
  id: 'txn-1',
  organizationId: 'org-1',
  financialAccountId: 'account-1',
  postedDate: '2026-07-01',
  descriptionOriginal: 'AMZN MKTP',
  descriptionNormalized: 'Amazon Marketplace',
  amountMinor: 1849900,
  currency: 'INR',
  direction: 'debit',
  externalReference: null,
  counterpartyRaw: 'Amazon India'
}

function request(overrides: Partial<CorrectionRequest> = {}): CorrectionRequest {
  return {
    organizationId: 'org-1',
    transactionId: 'txn-1',
    canonicalCategoryCode: 'expense.office_supplies',
    organizationCategoryMappingId: null,
    scope: 'transaction_only',
    reason: 'Office supplies purchase',
    ...overrides
  }
}

describe('correction scope policy', () => {
  it('does not create a predicate for transaction-only corrections', () => {
    expect(buildCorrectionPlan(request(), candidate)).toEqual({
      scope: 'transaction_only',
      predicate: null,
      storedScope: null
    })
  })

  it('creates a constrained exact-description predicate', () => {
    expect(buildCorrectionPlan(request({ scope: 'exact_description' }), candidate).predicate).toEqual({
      direction: 'debit',
      currency: 'INR',
      descriptionEquals: 'Amazon Marketplace'
    })
  })

  it('creates an explicit merchant amount range', () => {
    expect(
      buildCorrectionPlan(request({ scope: 'merchant_amount_range', amountToleranceMinor: 10000 }), candidate).predicate
    ).toEqual({
      direction: 'debit',
      currency: 'INR',
      counterpartyEquals: 'Amazon India',
      minAmountMinor: 1839900,
      maxAmountMinor: 1859900
    })
  })

  it('creates a recurrence key that excludes the transaction amount', () => {
    expect(buildCorrectionPlan(request({ scope: 'recurring_series' }), candidate).predicate).toEqual({
      recurrenceKey: 'amazon india|debit|INR'
    })
  })

  it('rejects merchant scopes when counterparty evidence is absent', () => {
    expect(() =>
      buildCorrectionPlan(request({ scope: 'merchant_entity_future' }), { ...candidate, counterpartyRaw: null })
    ).toThrow('requires a normalized counterparty')
  })
})
