import type {
  CategorizationCandidate,
  CorrectionRequest,
  RulePredicate,
  StoredRuleScope
} from './categorization-types'
import { LedgerlyError } from './errors'
import { buildRecurrenceKey } from './rule-engine'

export interface CorrectionPlan {
  scope: CorrectionRequest['scope']
  predicate: RulePredicate | null
  storedScope: StoredRuleScope | null
}

export function buildCorrectionPlan(
  request: CorrectionRequest,
  candidate: CategorizationCandidate
): CorrectionPlan {
  const common = {
    direction: candidate.direction,
    currency: candidate.currency.toUpperCase()
  } as const

  switch (request.scope) {
    case 'transaction_only':
      return { scope: request.scope, predicate: null, storedScope: null }
    case 'exact_description': {
      if (!candidate.descriptionNormalized.trim()) invalid('Exact-description scope needs a description')
      return {
        scope: request.scope,
        storedScope: request.scope,
        predicate: { ...common, descriptionEquals: candidate.descriptionNormalized }
      }
    }
    case 'merchant_amount_range': {
      const counterparty = requiredCounterparty(candidate)
      const tolerance = request.amountToleranceMinor ?? 0
      if (!Number.isSafeInteger(tolerance) || tolerance < 0) invalid('Amount tolerance must be a non-negative integer')
      return {
        scope: request.scope,
        storedScope: request.scope,
        predicate: {
          ...common,
          counterpartyEquals: counterparty,
          minAmountMinor: Math.max(0, candidate.amountMinor - tolerance),
          maxAmountMinor: candidate.amountMinor + tolerance
        }
      }
    }
    case 'recurring_series':
      return {
        scope: request.scope,
        storedScope: request.scope,
        predicate: { recurrenceKey: buildRecurrenceKey(candidate) }
      }
    case 'merchant_entity_future':
      return {
        scope: request.scope,
        storedScope: request.scope,
        predicate: { ...common, counterpartyEquals: requiredCounterparty(candidate) }
      }
    case 'historical_and_future_matches':
      return {
        scope: request.scope,
        storedScope: request.scope,
        predicate: candidate.counterpartyRaw?.trim()
          ? { ...common, counterpartyEquals: candidate.counterpartyRaw }
          : { ...common, descriptionEquals: candidate.descriptionNormalized }
      }
  }
}

function requiredCounterparty(candidate: CategorizationCandidate): string {
  const value = candidate.counterpartyRaw?.trim()
  if (!value) invalid('This correction scope requires a normalized counterparty')
  return value
}

function invalid(message: string): never {
  throw new LedgerlyError('RULE_INVALID_PREDICATE', message, 422)
}
