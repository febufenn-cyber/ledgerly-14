import type { Direction, UUID } from './types'

export type RuleScope =
  | 'transaction_only'
  | 'exact_description'
  | 'merchant_amount_range'
  | 'recurring_series'
  | 'merchant_entity_future'
  | 'historical_and_future_matches'

export type StoredRuleScope = Exclude<RuleScope, 'transaction_only'>
export type RuleStatus = 'draft' | 'active' | 'disabled' | 'superseded'
export type ClassificationStatus =
  | 'suggested'
  | 'approved'
  | 'corrected'
  | 'rejected'
  | 'unresolved'
  | 'conflict'
  | 'superseded'
export type ConfidenceBand = 'unknown' | 'low' | 'medium' | 'high' | 'automation_eligible'
export type ClassificationSource = 'rule' | 'history' | 'founder' | 'accountant'

export interface RulePredicate {
  descriptionEquals?: string
  counterpartyEquals?: string
  minAmountMinor?: number
  maxAmountMinor?: number
  direction?: Direction
  currency?: string
  recurrenceKey?: string
}

export interface CategorizationRule {
  id: UUID
  organization_id: UUID
  name: string
  scope: StoredRuleScope
  predicate_json: RulePredicate
  canonical_category_code: string
  organization_category_mapping_id: UUID | null
  priority: number
  specificity: number
  source_role: 'founder' | 'accountant'
  status: RuleStatus
  version: number
  created_by: UUID
  approved_by: UUID | null
  created_at: string
  updated_at: string
}

export interface CategorizationCandidate {
  id: UUID
  organizationId: UUID
  financialAccountId: UUID
  postedDate: string
  descriptionOriginal: string
  descriptionNormalized: string
  amountMinor: number
  currency: string
  direction: Direction
  externalReference: string | null
  counterpartyRaw: string | null
}

export interface RuleEvidence {
  type: 'classification_rule'
  ruleId: UUID
  ruleName: string
  scope: StoredRuleScope
  priority: number
  specificity: number
  sourceRole: 'founder' | 'accountant'
}

export interface RuleSuggestion {
  transactionId: UUID
  canonicalCategoryCode: string | null
  sourceRuleId: UUID | null
  confidenceBand: ConfidenceBand
  status: 'suggested' | 'conflict' | 'unresolved'
  evidence: RuleEvidence[]
  alternatives: string[]
  requiresFounderReview: boolean
  requiresAccountantReview: boolean
}

export interface CorrectionRequest {
  organizationId: UUID
  transactionId: UUID
  canonicalCategoryCode: string
  organizationCategoryMappingId: UUID | null
  scope: RuleScope
  reason: string
  amountToleranceMinor?: number
}

export interface ClassificationDecisionRecord {
  id: UUID
  organization_id: UUID
  normalized_transaction_id: UUID
  canonical_category_code: string | null
  organization_category_mapping_id: UUID | null
  decision_source: ClassificationSource
  source_rule_id: UUID | null
  confidence_band: ConfidenceBand
  status: ClassificationStatus
  evidence_json: unknown[]
  alternatives_json: string[]
  requires_founder_review: boolean
  requires_accountant_review: boolean
  is_current: boolean
  created_at: string
}
