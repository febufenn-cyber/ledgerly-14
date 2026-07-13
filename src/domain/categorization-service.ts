import type {
  CategorizationCandidate,
  CategorizationRule,
  CorrectionRequest,
  RulePredicate,
  RuleSuggestion
} from './categorization-types'
import { buildCorrectionPlan } from './correction-policy'
import { evaluateRules } from './rule-engine'

export interface CategorizationRepositoryPort {
  listCandidates(organizationId: string, limit: number): Promise<CategorizationCandidate[]>
  listActiveRules(organizationId: string): Promise<CategorizationRule[]>
  storeSuggestions(organizationId: string, suggestions: RuleSuggestion[]): Promise<unknown>
  getTransaction(organizationId: string, transactionId: string): Promise<CategorizationCandidate>
  recordCorrection(input: {
    request: CorrectionRequest
    predicate: RulePredicate | null
  }): Promise<unknown>
}

export class CategorizationService {
  constructor(private readonly repository: CategorizationRepositoryPort) {}

  async runRules(organizationId: string, limit = 100): Promise<{
    evaluated: number
    suggested: number
    conflicts: number
    unresolved: number
    persistence: unknown
  }> {
    const [candidates, rules] = await Promise.all([
      this.repository.listCandidates(organizationId, limit),
      this.repository.listActiveRules(organizationId)
    ])
    const suggestions = candidates.map((candidate) => evaluateRules(candidate, rules))
    const persistence = await this.repository.storeSuggestions(organizationId, suggestions)
    return {
      evaluated: suggestions.length,
      suggested: suggestions.filter((item) => item.status === 'suggested').length,
      conflicts: suggestions.filter((item) => item.status === 'conflict').length,
      unresolved: suggestions.filter((item) => item.status === 'unresolved').length,
      persistence
    }
  }

  async correct(request: CorrectionRequest): Promise<unknown> {
    const candidate = await this.repository.getTransaction(request.organizationId, request.transactionId)
    const plan = buildCorrectionPlan(request, candidate)
    return this.repository.recordCorrection({ request, predicate: plan.predicate })
  }
}
