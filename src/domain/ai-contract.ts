import { z } from 'zod'
import type { AiPolicyValidation, AiSuggestionInput, AiSuggestionOutput } from './ai-types'

const reasonCodeSchema = z.enum([
  'merchant_context',
  'description_context',
  'amount_pattern',
  'historical_context',
  'deterministic_conflict',
  'insufficient_business_context',
  'high_risk_accounting',
  'unsupported_case'
])

export const aiSuggestionOutputSchema = z
  .object({
    outcome: z.enum(['suggestion', 'insufficient_evidence', 'refusal']),
    suggestedCategoryCode: z.string().min(1).nullable(),
    alternatives: z.array(z.string().min(1)).max(5),
    evidenceReferenceIds: z.array(z.string().min(1)).max(20),
    reasonCodes: z.array(reasonCodeSchema).min(1).max(8),
    confidenceBand: z.enum(['unknown', 'low', 'medium', 'high']),
    founderQuestion: z.string().trim().min(1).max(300).nullable(),
    requiresFounderReview: z.literal(true),
    requiresAccountantReview: z.boolean(),
    explanation: z.string().trim().min(1).max(800)
  })
  .strict()

export function validateAiSuggestionOutput(input: AiSuggestionInput, raw: unknown): AiPolicyValidation {
  const parsed = aiSuggestionOutputSchema.safeParse(raw)
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((issue) => issue.message), output: null }
  }

  const output = parsed.data as AiSuggestionOutput
  const errors: string[] = []
  const categories = new Map(input.allowedCategories.map((category) => [category.code, category]))
  const evidenceIds = new Set(input.authorizedEvidence.map((evidence) => evidence.id))

  if (output.outcome === 'suggestion' && output.suggestedCategoryCode === null) {
    errors.push('A suggestion outcome requires a category')
  }
  if (output.outcome !== 'suggestion' && output.suggestedCategoryCode !== null) {
    errors.push('Non-suggestion outcomes cannot contain a category')
  }
  if (output.outcome !== 'suggestion' && !['unknown', 'low'].includes(output.confidenceBand)) {
    errors.push('Non-suggestion outcomes cannot claim medium or high confidence')
  }
  if (output.suggestedCategoryCode !== null && !categories.has(output.suggestedCategoryCode)) {
    errors.push(`Category is not authorized: ${output.suggestedCategoryCode}`)
  }

  const uniqueAlternatives = new Set(output.alternatives)
  if (uniqueAlternatives.size !== output.alternatives.length) errors.push('Alternatives must be unique')
  for (const alternative of output.alternatives) {
    if (!categories.has(alternative)) errors.push(`Alternative category is not authorized: ${alternative}`)
    if (alternative === output.suggestedCategoryCode) errors.push('Suggested category cannot also be an alternative')
  }

  const uniqueEvidence = new Set(output.evidenceReferenceIds)
  if (uniqueEvidence.size !== output.evidenceReferenceIds.length) errors.push('Evidence references must be unique')
  for (const evidenceId of output.evidenceReferenceIds) {
    if (!evidenceIds.has(evidenceId)) errors.push(`Evidence reference is not authorized: ${evidenceId}`)
  }
  if (output.outcome === 'suggestion' && output.evidenceReferenceIds.length === 0) {
    errors.push('A category suggestion requires evidence')
  }

  const category = output.suggestedCategoryCode === null ? null : categories.get(output.suggestedCategoryCode)
  if (category?.risk === 'high' && !output.requiresAccountantReview) {
    errors.push('High-risk categories require accountant review')
  }

  if (errors.length > 0) return { valid: false, errors, output: null }
  return { valid: true, errors: [], output }
}

export function unresolvedAiOutput(reason: string): AiSuggestionOutput {
  return {
    outcome: 'insufficient_evidence',
    suggestedCategoryCode: null,
    alternatives: [],
    evidenceReferenceIds: [],
    reasonCodes: ['insufficient_business_context'],
    confidenceBand: 'unknown',
    founderQuestion: 'Please provide the business purpose of this transaction.',
    requiresFounderReview: true,
    requiresAccountantReview: false,
    explanation: reason
  }
}
