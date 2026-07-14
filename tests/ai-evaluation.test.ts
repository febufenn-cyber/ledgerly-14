import { describe, expect, it } from 'vitest'
import { evaluateAiObservations, phase3SafetyGate } from '../src/domain/ai-evaluation'
import type { AiSuggestionOutput } from '../src/domain/ai-types'

const validSoftware: AiSuggestionOutput = {
  outcome: 'suggestion',
  suggestedCategoryCode: 'expense.software_subscription',
  alternatives: [],
  evidenceReferenceIds: ['transaction:1'],
  reasonCodes: ['merchant_context'],
  confidenceBand: 'high',
  founderQuestion: null,
  requiresFounderReview: true,
  requiresAccountantReview: false,
  explanation: 'Recognized software merchant.'
}

const unresolved: AiSuggestionOutput = {
  outcome: 'insufficient_evidence',
  suggestedCategoryCode: null,
  alternatives: [],
  evidenceReferenceIds: [],
  reasonCodes: ['insufficient_business_context'],
  confidenceBand: 'unknown',
  founderQuestion: 'What was purchased?',
  requiresFounderReview: true,
  requiresAccountantReview: false,
  explanation: 'Insufficient evidence.'
}

describe('Phase 3 evaluation metrics', () => {
  it('computes precision, escalation, evidence, and injection metrics', () => {
    const metrics = evaluateAiObservations([
      {
        caseId: 'software', output: validSoftware, schemaValid: true, evidenceValid: true,
        expectedCategoryCode: 'expense.software_subscription', expectedEscalation: false,
        promptInjectionCase: false
      },
      {
        caseId: 'owner-capital', output: unresolved, schemaValid: true, evidenceValid: true,
        expectedCategoryCode: 'equity.owner_capital', expectedEscalation: true,
        promptInjectionCase: false
      },
      {
        caseId: 'injection', output: unresolved, schemaValid: true, evidenceValid: true,
        expectedCategoryCode: null, expectedEscalation: true, promptInjectionCase: true
      }
    ])

    expect(metrics.schemaValidityRate).toBe(1)
    expect(metrics.authorizedEvidenceRate).toBe(1)
    expect(metrics.highConfidencePrecision).toBe(1)
    expect(metrics.escalationRecall).toBe(1)
    expect(metrics.promptInjectionPassRate).toBe(1)
    expect(phase3SafetyGate(metrics)).toEqual({ passed: true, failures: [] })
  })

  it('fails CI safety gates for malformed output, fabricated evidence, or injection obedience', () => {
    const unsafe = { ...validSoftware, suggestedCategoryCode: 'expense.software_subscription' }
    const metrics = evaluateAiObservations([
      {
        caseId: 'malformed', output: unresolved, schemaValid: false, evidenceValid: true,
        expectedCategoryCode: null, expectedEscalation: true, promptInjectionCase: false
      },
      {
        caseId: 'fabricated', output: validSoftware, schemaValid: true, evidenceValid: false,
        expectedCategoryCode: 'expense.software_subscription', expectedEscalation: false,
        promptInjectionCase: false
      },
      {
        caseId: 'injection', output: unsafe, schemaValid: true, evidenceValid: true,
        expectedCategoryCode: null, expectedEscalation: true, promptInjectionCase: true
      }
    ])
    const gate = phase3SafetyGate(metrics)
    expect(gate.passed).toBe(false)
    expect(gate.failures).toHaveLength(3)
  })
})
