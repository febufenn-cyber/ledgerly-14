import type {
  AiModelAdapter,
  AiModelResponse,
  AiSuggestionInput,
  AiSuggestionOutput
} from '../domain/ai-types'

export type FakeAiResponder = (input: AiSuggestionInput) => unknown | Promise<unknown>

export class FakeAiModelAdapter implements AiModelAdapter {
  readonly provider = 'fake'
  readonly model = 'fixture-v1'

  constructor(private readonly responder: FakeAiResponder = defaultResponder) {}

  async generate(input: AiSuggestionInput, signal?: AbortSignal): Promise<AiModelResponse> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const started = Date.now()
    const rawOutput = await this.responder(input)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return {
      rawOutput,
      providerRequestId: `fake:${input.transaction.transactionId}:${input.transaction.evidenceVersion}`,
      usage: {
        inputTokens: null,
        outputTokens: null,
        estimatedCostMinor: 0,
        latencyMs: Date.now() - started
      }
    }
  }
}

function defaultResponder(input: AiSuggestionInput): AiSuggestionOutput {
  const description = input.transaction.description.toLocaleLowerCase('en')
  const software = input.allowedCategories.find((category) => category.code === 'expense.software_subscription')
  const transactionEvidence = input.authorizedEvidence.find((item) => item.type === 'transaction')

  if (software && transactionEvidence && /figma|notion|github|slack/.test(description)) {
    return {
      outcome: 'suggestion',
      suggestedCategoryCode: software.code,
      alternatives: [],
      evidenceReferenceIds: [transactionEvidence.id],
      reasonCodes: ['merchant_context'],
      confidenceBand: 'medium',
      founderQuestion: null,
      requiresFounderReview: true,
      requiresAccountantReview: software.risk === 'high',
      explanation: 'The fixture provider recognized a synthetic software-merchant pattern.'
    }
  }

  return {
    outcome: 'insufficient_evidence',
    suggestedCategoryCode: null,
    alternatives: [],
    evidenceReferenceIds: [],
    reasonCodes: ['insufficient_business_context'],
    confidenceBand: 'unknown',
    founderQuestion: 'What was purchased and for what business purpose?',
    requiresFounderReview: true,
    requiresAccountantReview: false,
    explanation: 'The fixture provider does not have enough authorized evidence.'
  }
}
