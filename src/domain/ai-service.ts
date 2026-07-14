import { validateAiSuggestionOutput, unresolvedAiOutput } from './ai-contract'
import type {
  AiModelAdapter,
  AiModelResponse,
  AiSuggestionInput,
  AiSuggestionOutput
} from './ai-types'
import { LedgerlyError } from './errors'
import { sha256Text } from './fingerprints'

export interface AiExecutionContext {
  input: AiSuggestionInput
  enabled: boolean
  provider: string
  model: string
  timeoutMs: number
  retryLimit: number
  circuitState: 'closed' | 'open' | 'half_open'
}

export interface BeginAiRunResult {
  runId: string
  cached: boolean
}

export interface AiRunResult {
  runId: string
  cached: boolean
  status: 'succeeded' | 'invalid_output' | 'provider_failed' | 'blocked'
  suggestion: AiSuggestionOutput
  providerRequestId: string | null
}

export interface AiRepositoryPort {
  getContext(organizationId: string, transactionId: string): Promise<AiExecutionContext>
  beginRun(input: {
    organizationId: string
    transactionId: string
    idempotencyKey: string
    inputHash: string
    authorizedEvidenceIds: string[]
    allowedCategoryCodes: string[]
    minimizedInput: AiSuggestionInput
  }): Promise<BeginAiRunResult>
  getRunResult(runId: string): Promise<AiRunResult>
  completeRun(input: {
    runId: string
    status: AiRunResult['status']
    output: AiSuggestionOutput
    errorCode: string | null
    response: AiModelResponse | null
  }): Promise<AiRunResult>
}

function cleanUntrustedText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function minimizeAiInput(input: AiSuggestionInput): AiSuggestionInput {
  return {
    ...input,
    transaction: {
      ...input.transaction,
      description: cleanUntrustedText(input.transaction.description, 500),
      counterparty: input.transaction.counterparty === null
        ? null
        : cleanUntrustedText(input.transaction.counterparty, 200)
    },
    allowedCategories: input.allowedCategories.map((category) => ({ ...category })),
    authorizedEvidence: input.authorizedEvidence.map((evidence) => ({ ...evidence })),
    deterministic: {
      ...input.deterministic,
      matchedRuleIds: [...input.deterministic.matchedRuleIds],
      alternatives: [...input.deterministic.alternatives]
    }
  }
}

async function callWithTimeout(
  adapter: AiModelAdapter,
  input: AiSuggestionInput,
  timeoutMs: number
): Promise<AiModelResponse> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new LedgerlyError('AI_TIMEOUT', 'AI provider timed out', 504))
    }, timeoutMs)
  })

  try {
    return await Promise.race([adapter.generate(input, controller.signal), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export class AiSuggestionService {
  constructor(
    private readonly repository: AiRepositoryPort,
    private readonly adapter: AiModelAdapter
  ) {}

  async run(organizationId: string, transactionId: string): Promise<AiRunResult> {
    const context = await this.repository.getContext(organizationId, transactionId)
    if (!context.enabled) throw new LedgerlyError('AI_DISABLED', 'AI suggestions are disabled', 409)
    if (context.circuitState === 'open') throw new LedgerlyError('AI_CIRCUIT_OPEN', 'AI circuit is open', 503)
    if (context.provider !== this.adapter.provider || context.model !== this.adapter.model) {
      throw new LedgerlyError('AI_PROVIDER_MISMATCH', 'Configured AI provider is not available', 409)
    }

    const input = minimizeAiInput(context.input)
    const serialized = JSON.stringify(input)
    const inputHash = await sha256Text(serialized)
    const idempotencyKey = await sha256Text(JSON.stringify([
      organizationId,
      transactionId,
      input.transaction.evidenceVersion,
      input.deterministic.decisionVersion,
      this.adapter.provider,
      this.adapter.model,
      input.promptVersion,
      input.policyVersion,
      input.schemaVersion,
      inputHash
    ]))

    const begun = await this.repository.beginRun({
      organizationId,
      transactionId,
      idempotencyKey,
      inputHash,
      authorizedEvidenceIds: input.authorizedEvidence.map((item) => item.id),
      allowedCategoryCodes: input.allowedCategories.map((item) => item.code),
      minimizedInput: input
    })
    if (begun.cached) return this.repository.getRunResult(begun.runId)

    let lastError: unknown
    for (let attempt = 0; attempt <= context.retryLimit; attempt += 1) {
      try {
        const response = await callWithTimeout(this.adapter, input, context.timeoutMs)
        const validation = validateAiSuggestionOutput(input, response.rawOutput)
        if (!validation.valid || validation.output === null) {
          return this.repository.completeRun({
            runId: begun.runId,
            status: 'invalid_output',
            output: unresolvedAiOutput(`Model output was rejected by policy: ${validation.errors.join('; ')}`),
            errorCode: 'AI_OUTPUT_INVALID',
            response
          })
        }
        return this.repository.completeRun({
          runId: begun.runId,
          status: 'succeeded',
          output: validation.output,
          errorCode: null,
          response
        })
      } catch (error) {
        lastError = error
      }
    }

    const code = lastError instanceof LedgerlyError ? lastError.code : 'AI_PROVIDER_FAILED'
    return this.repository.completeRun({
      runId: begun.runId,
      status: 'provider_failed',
      output: unresolvedAiOutput('The AI provider failed; no category was applied.'),
      errorCode: code,
      response: null
    })
  }
}
