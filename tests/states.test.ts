import { describe, expect, it } from 'vitest'
import { assertAttemptTransition, assertImportTransition } from '../src/domain/states'

describe('state machines', () => {
  it('allows the staged import commit path', () => {
    expect(() => assertImportTransition('awaiting_confirmation', 'committing')).not.toThrow()
    expect(() => assertImportTransition('committing', 'committed')).not.toThrow()
    expect(() => assertAttemptTransition('staged', 'committed')).not.toThrow()
  })

  it('blocks impossible backwards transitions', () => {
    expect(() => assertImportTransition('committed', 'parsing')).toThrow(/Invalid import transition/)
    expect(() => assertAttemptTransition('committed', 'running')).toThrow(/Invalid attempt transition/)
  })
})
