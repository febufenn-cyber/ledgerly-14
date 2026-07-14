import type {
  AiRepositoryPort,
  AiExecutionContext,
  AiRunResult,
  BeginAiRunResult
} from '../domain/ai-service'
import type { AiSuggestionInput, AiSuggestionOutput } from '../domain/ai-types'
import { LedgerlyError } from '../domain/errors'
import { SupabaseRestClient } from './supabase'

interface RawAiContext {
  policy: {
    enabled: boolean
    provider: string
    model: string
    promptVersion: string
    policyVersion: string
    schemaVersion: string
    timeoutMs: number
    retryLimit: number
    circuitState: 'closed' | 'open' | 'half_open'
  }
  transaction: AiSuggestionInput['transaction']
  deterministic: AiSuggestionInput['deterministic']
  allowedCategories: AiSuggestionInput['allowedCategories']
  authorizedEvidence: AiSuggestionInput['authorizedEvidence']
}

interface RunRow {
  id: string
  status: AiRunResult['status'] | 'pending' | 'running'
  provider_request_id: string | null
}

interface SuggestionRow {
  outcome: AiSuggestionOutput['outcome']
  canonical_category_code: string | null
  confidence_band: AiSuggestionOutput['confidenceBand']
  alternatives_json: string[]
  evidence_reference_ids_json: string[]
  reason_codes_json: AiSuggestionOutput['reasonCodes']
  founder_question: string | null
  requires_founder_review: true
  requires_accountant_review: boolean
  explanation: string
}

export class AiRepository implements AiRepositoryPort {
  constructor(private readonly db: SupabaseRestClient) {}

  async getContext(organizationId: string, transactionId: string): Promise<AiExecutionContext> {
    const raw = await this.db.rpc<RawAiContext>('get_ai_policy_context', {
      p_organization_id: organizationId,
      p_transaction_id: transactionId
    })
    return {
      enabled: raw.policy.enabled,
      provider: raw.policy.provider,
      model: raw.policy.model,
      timeoutMs: raw.policy.timeoutMs,
      retryLimit: raw.policy.retryLimit,
      circuitState: raw.policy.circuitState,
      input: {
        organizationId,
        transaction: raw.transaction,
        deterministic: raw.deterministic,
        allowedCategories: raw.allowedCategories,
        authorizedEvidence: raw.authorizedEvidence,
        promptVersion: raw.policy.promptVersion,
        policyVersion: raw.policy.policyVersion,
        schemaVersion: raw.policy.schemaVersion
      }
    }
  }

  async beginRun(input: {
    organizationId: string
    transactionId: string
    idempotencyKey: string
    inputHash: string
    authorizedEvidenceIds: string[]
    allowedCategoryCodes: string[]
    minimizedInput: AiSuggestionInput
  }): Promise<BeginAiRunResult> {
    const result = await this.db.rpc<{ runId: string; cached: boolean }>('begin_ai_model_run', {
      p_organization_id: input.organizationId,
      p_transaction_id: input.transactionId,
      p_idempotency_key: input.idempotencyKey,
      p_input_hash: input.inputHash,
      p_authorized_evidence: input.authorizedEvidenceIds,
      p_allowed_categories: input.allowedCategoryCodes,
      p_minimized_input: input.minimizedInput
    })
    return { runId: result.runId, cached: result.cached }
  }

  async getRunResult(runId: string): Promise<AiRunResult> {
    const runs = await this.db.table<RunRow[]>('ai_model_runs', {
      query: { id: `eq.${runId}`, select: 'id,status,provider_request_id', limit: '1' }
    })
    const run = runs[0]
    if (!run || run.status === 'pending' || run.status === 'running') {
      throw new LedgerlyError('AI_RUN_NOT_FOUND', 'Completed AI run not found', 404)
    }
    const suggestions = await this.db.table<SuggestionRow[]>('ai_suggestions', {
      query: { model_run_id: `eq.${runId}`, select: '*', order: 'created_at.desc', limit: '1' }
    })
    const row = suggestions[0]
    if (!row) throw new LedgerlyError('AI_RUN_NOT_FOUND', 'AI suggestion not found', 404)
    return {
      runId,
      cached: true,
      status: run.status,
      providerRequestId: run.provider_request_id,
      suggestion: {
        outcome: row.outcome,
        suggestedCategoryCode: row.canonical_category_code,
        alternatives: row.alternatives_json,
        evidenceReferenceIds: row.evidence_reference_ids_json,
        reasonCodes: row.reason_codes_json,
        confidenceBand: row.confidence_band,
        founderQuestion: row.founder_question,
        requiresFounderReview: true,
        requiresAccountantReview: row.requires_accountant_review,
        explanation: row.explanation
      }
    }
  }

  async completeRun(input: Parameters<AiRepositoryPort['completeRun']>[0]): Promise<AiRunResult> {
    await this.db.rpc('complete_ai_model_run', {
      p_run_id: input.runId,
      p_status: input.status,
      p_output: input.output,
      p_error_code: input.errorCode,
      p_provider_request_id: input.response?.providerRequestId ?? null,
      p_input_tokens: input.response?.usage.inputTokens ?? null,
      p_output_tokens: input.response?.usage.outputTokens ?? null,
      p_estimated_cost_minor: input.response?.usage.estimatedCostMinor ?? null,
      p_latency_ms: input.response?.usage.latencyMs ?? null
    })
    const result = await this.getRunResult(input.runId)
    return { ...result, cached: false }
  }
}
