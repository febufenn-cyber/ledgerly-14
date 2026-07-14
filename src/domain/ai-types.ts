import type { Direction, UUID } from './types'

export type AiConfidenceBand = 'unknown' | 'low' | 'medium' | 'high'
export type AiOutcome = 'suggestion' | 'insufficient_evidence' | 'refusal'
export type AiRunStatus = 'pending' | 'running' | 'succeeded' | 'invalid_output' | 'provider_failed' | 'blocked'
export type AiReasonCode =
  | 'merchant_context'
  | 'description_context'
  | 'amount_pattern'
  | 'historical_context'
  | 'deterministic_conflict'
  | 'insufficient_business_context'
  | 'high_risk_accounting'
  | 'unsupported_case'

export interface AiAllowedCategory {
  code: string
  label: string
  risk: 'low' | 'medium' | 'high'
}

export interface AiEvidenceReference {
  id: string
  type: 'transaction' | 'source_row' | 'deterministic_rule' | 'historical_decision' | 'account_mapping'
}

export interface AiTransactionEvidence {
  transactionId: UUID
  evidenceVersion: string
  postedDate: string
  amountMinor: number
  currency: string
  direction: Direction
  description: string
  counterparty: string | null
  externalReferencePresent: boolean
}

export interface AiDeterministicContext {
  status: 'unresolved' | 'conflict'
  decisionVersion: string
  matchedRuleIds: UUID[]
  alternatives: string[]
}

export interface AiSuggestionInput {
  organizationId: UUID
  transaction: AiTransactionEvidence
  deterministic: AiDeterministicContext
  allowedCategories: AiAllowedCategory[]
  authorizedEvidence: AiEvidenceReference[]
  promptVersion: string
  policyVersion: string
  schemaVersion: string
}

export interface AiSuggestionOutput {
  outcome: AiOutcome
  suggestedCategoryCode: string | null
  alternatives: string[]
  evidenceReferenceIds: string[]
  reasonCodes: AiReasonCode[]
  confidenceBand: AiConfidenceBand
  founderQuestion: string | null
  requiresFounderReview: true
  requiresAccountantReview: boolean
  explanation: string
}

export interface AiModelUsage {
  inputTokens: number | null
  outputTokens: number | null
  estimatedCostMinor: number | null
  latencyMs: number
}

export interface AiModelResponse {
  rawOutput: unknown
  providerRequestId: string | null
  usage: AiModelUsage
}

export interface AiModelAdapter {
  readonly provider: string
  readonly model: string
  generate(input: AiSuggestionInput, signal?: AbortSignal): Promise<AiModelResponse>
}

export interface AiPolicyValidation {
  valid: boolean
  errors: string[]
  output: AiSuggestionOutput | null
}
