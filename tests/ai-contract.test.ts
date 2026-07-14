import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { unresolvedAiOutput, validateAiSuggestionOutput } from '../src/domain/ai-contract'
import type { AiSuggestionInput } from '../src/domain/ai-types'

interface FixtureCase {
  caseId: string
  expectedValid: boolean
  input: Pick<AiSuggestionInput, 'transaction' | 'deterministic'>
  output: unknown
}

const fixtures = readFileSync(new URL('../fixtures/phase-3/eval-cases.jsonl', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as FixtureCase)

function inputFor(item: FixtureCase): AiSuggestionInput {
  return {
    organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    transaction: item.input.transaction,
    deterministic: item.input.deterministic,
    allowedCategories: [
      { code: 'expense.software_subscription', label: 'Software and Subscriptions', risk: 'low' },
      { code: 'expense.professional_fees', label: 'Professional Fees', risk: 'medium' },
      { code: 'equity.owner_capital', label: 'Owner Capital', risk: 'high' }
    ],
    authorizedEvidence: [
      { id: `transaction:${item.input.transaction.transactionId}`, type: 'transaction' }
    ],
    promptVersion: 'phase-3-prompt-v1',
    policyVersion: 'phase-3-policy-v1',
    schemaVersion: 'phase-3-schema-v1'
  }
}

describe('AI suggestion contract', () => {
  for (const fixture of fixtures) {
    it(`${fixture.caseId} matches the expected policy result`, () => {
      const result = validateAiSuggestionOutput(inputFor(fixture), fixture.output)
      expect(result.valid).toBe(fixture.expectedValid)
      expect(result.output === null).toBe(!fixture.expectedValid)
    })
  }

  it('rejects action-like or unknown fields', () => {
    const fixture = fixtures[0]!
    const output = { ...(fixture.output as Record<string, unknown>), approveTransaction: true }
    expect(validateAiSuggestionOutput(inputFor(fixture), output).valid).toBe(false)
  })

  it('creates a founder-review-only unresolved fallback', () => {
    const output = unresolvedAiOutput('Provider failed safely')
    expect(output.outcome).toBe('insufficient_evidence')
    expect(output.suggestedCategoryCode).toBeNull()
    expect(output.requiresFounderReview).toBe(true)
  })
})
