import { describe, expect, it } from 'vitest'
import { AiSuggestionService, minimizeAiInput, type AiRepositoryPort, type AiRunResult } from '../src/domain/ai-service'
import type { AiSuggestionInput } from '../src/domain/ai-types'
import { LedgerlyError } from '../src/domain/errors'
import { FakeAiModelAdapter } from '../src/infra/fake-ai-adapter'

const input: AiSuggestionInput = {
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  transaction: {
    transactionId: '11111111-1111-4111-8111-111111111111',
    evidenceVersion: 'evidence-v1',
    postedDate: '2026-06-01',
    amountMinor: 120000,
    currency: 'INR',
    direction: 'debit',
    description: 'FIGMA\u0000\n MONTHLY',
    counterparty: 'Figma',
    externalReferencePresent: true
  },
  deterministic: {
    status: 'unresolved',
    decisionVersion: 'decision-v1',
    matchedRuleIds: [],
    alternatives: []
  },
  allowedCategories: [
    { code: 'expense.software_subscription', label: 'Software and Subscriptions', risk: 'low' }
  ],
  authorizedEvidence: [
    { id: 'transaction:11111111-1111-4111-8111-111111111111', type: 'transaction' }
  ],
  promptVersion: 'phase-3-prompt-v1',
  policyVersion: 'phase-3-policy-v1',
  schemaVersion: 'phase-3-schema-v1'
}

class MemoryRepository implements AiRepositoryPort {
  context = {
    input,
    enabled: true,
    provider: 'fake',
    model: 'fixture-v1',
    timeoutMs: 1000,
    retryLimit: 0,
    circuitState: 'closed' as const
  }
  beginCount = 0
  completeCount = 0
  lastMinimized: AiSuggestionInput | null = null
  private cachedResult: AiRunResult | null = null

  async getContext() { return this.context }

  async beginRun(value: Parameters<AiRepositoryPort['beginRun']>[0]) {
    this.beginCount += 1
    this.lastMinimized = value.minimizedInput
    return { runId: 'run-1', cached: this.cachedResult !== null }
  }

  async getRunResult() {
    if (!this.cachedResult) throw new Error('missing result')
    return { ...this.cachedResult, cached: true }
  }

  async completeRun(value: Parameters<AiRepositoryPort['completeRun']>[0]) {
    this.completeCount += 1
    const result: AiRunResult = {
      runId: value.runId,
      cached: false,
      status: value.status,
      suggestion: value.output,
      providerRequestId: value.response?.providerRequestId ?? null
    }
    this.cachedResult = result
    return result
  }
}

describe('AI suggestion service', () => {
  it('persists a valid result as suggestion-only and reuses the idempotent run', async () => {
    const repository = new MemoryRepository()
    const service = new AiSuggestionService(repository, new FakeAiModelAdapter())

    const first = await service.run(input.organizationId, input.transaction.transactionId)
    const second = await service.run(input.organizationId, input.transaction.transactionId)

    expect(first.status).toBe('succeeded')
    expect(first.suggestion.suggestedCategoryCode).toBe('expense.software_subscription')
    expect(first.suggestion.requiresFounderReview).toBe(true)
    expect(second.cached).toBe(true)
    expect(repository.completeCount).toBe(1)
    expect(repository.lastMinimized?.transaction.description).toBe('FIGMA MONTHLY')
  })

  it('turns fabricated evidence into an unresolved invalid-output result', async () => {
    const repository = new MemoryRepository()
    const adapter = new FakeAiModelAdapter(() => ({
      outcome: 'suggestion',
      suggestedCategoryCode: 'expense.software_subscription',
      alternatives: [],
      evidenceReferenceIds: ['invented:evidence'],
      reasonCodes: ['merchant_context'],
      confidenceBand: 'high',
      founderQuestion: null,
      requiresFounderReview: true,
      requiresAccountantReview: false,
      explanation: 'Unsafe fabricated evidence.'
    }))

    const result = await new AiSuggestionService(repository, adapter)
      .run(input.organizationId, input.transaction.transactionId)

    expect(result.status).toBe('invalid_output')
    expect(result.suggestion.outcome).toBe('insufficient_evidence')
    expect(result.suggestion.suggestedCategoryCode).toBeNull()
  })

  it('turns provider failure into unresolved without applying a category', async () => {
    const repository = new MemoryRepository()
    const adapter = new FakeAiModelAdapter(() => { throw new Error('provider down') })

    const result = await new AiSuggestionService(repository, adapter)
      .run(input.organizationId, input.transaction.transactionId)

    expect(result.status).toBe('provider_failed')
    expect(result.suggestion.suggestedCategoryCode).toBeNull()
    expect(result.suggestion.requiresFounderReview).toBe(true)
  })

  it('rejects a configured provider mismatch before creating a run', async () => {
    const repository = new MemoryRepository()
    repository.context = { ...repository.context, provider: 'other' }
    const service = new AiSuggestionService(repository, new FakeAiModelAdapter())

    await expect(service.run(input.organizationId, input.transaction.transactionId))
      .rejects.toMatchObject<Partial<LedgerlyError>>({ code: 'AI_PROVIDER_MISMATCH' })
    expect(repository.beginCount).toBe(0)
  })

  it('bounds and cleans untrusted text without changing accounting fields', () => {
    const minimized = minimizeAiInput({
      ...input,
      transaction: { ...input.transaction, description: `x\u0000${'y'.repeat(700)}` }
    })
    expect(minimized.transaction.description).not.toContain('\u0000')
    expect(minimized.transaction.description.length).toBe(500)
    expect(minimized.transaction.amountMinor).toBe(input.transaction.amountMinor)
  })
})
