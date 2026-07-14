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
  id?: string
  organization_id?: string
  normalized_transaction_id?: string
  model_run_id?: string
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
  created_at?: string
}

export interface AiPolicyRecord {
  organization_id: string
  enabled: boolean
  provider: string
  model: string
  prompt_version: string
  policy_version: string
  schema_version: string
  monthly_budget_minor: number
  timeout_ms: number
  retry_limit: number
  circuit_state: 'closed' | 'open' | 'half_open'
  updated_at: string
}

export interface AiRunDiagnostic {
  id: string
  organization_id: string
  normalized_transaction_id: string
  status: string
  provider: string
  model: string
  prompt_version: string
  policy_version: string
  schema_version: string
  error_code: string | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost_minor: number | null
  latency_ms: number | null
  created_at: string
  completed_at: string | null
}

export class AiRepository implements AiRepositoryPort {
  constructor(private readonly db: SupabaseRestClient) {}

  async configurePolicy(input: {
    organizationId: string
    enabled: boolean
    provider: string
    model: string
    promptVersion: string
    policyVersion: string
    schemaVersion: string
    monthlyBudgetMinor: number
    timeoutMs: number
    retryLimit: number
  }): Promise<unknown> {
    return this.db.rpc('configure_ai_policy', {
      p_organization_id: input.organizationId,
      p_enabled: input.enabled,
      p_provider: input.provider,
      p_model: input.model,
      p_prompt_version: input.promptVersion,
      p_policy_version: input.policyVersion,
      p_schema_version: input.schemaVersion,
      p_monthly_budget_minor: input.monthlyBudgetMinor,
      p_timeout_ms: input.timeoutMs,
      p_retry_limit: input.retryLimit
    })
  }

  async getPolicy(organizationId: string): Promise<AiPolicyRecord | null> {
    const rows = await this.db.table<AiPolicyRecord[]>('organization_ai_policies', {
      query: { organization_id: `eq.${organizationId}`, select: '*', limit: '1' }
    })
    return rows[0] ?? null
  }

  async listSuggestions(organizationId: string, limit: number): Promise<SuggestionRow[]> {
    return this.db.table<SuggestionRow[]>('ai_suggestions', {
      query: {
        organization_id: `eq.${organizationId}`,
        is_current: 'eq.true',
        select: '*',
        order: 'created_at.desc',
        limit: String(limit)
      }
    })
  }

  async getRunDiagnostic(runId: string): Promise<AiRunDiagnostic> {
    const rows = await this.db.table<AiRunDiagnostic[]>('ai_model_runs', {
      query: {
        id: `eq.${runId}`,
        select: 'id,organization_id,normalized_transaction_id,status,provider,model,prompt_version,policy_version,schema_version,error_code,input_tokens,output_tokens,estimated_cost_minor,latency_ms,created_at,completed_at',
        limit: '1'
      }
    })
    const row = rows[0]
    if (!row) throw new LedgerlyError('AI_RUN_NOT_FOUND', 'AI run not found', 404)
    return row
  }

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
