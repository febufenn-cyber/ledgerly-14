import { describe, expect, it } from 'vitest'
import { parseMoney, parseSeparateDebitCredit } from '../src/domain/money'

describe('money normalization', () => {
  it.each([
    ['1,23,456.78', 12345678, 'credit'],
    ['(1,500.00)', 150000, 'debit'],
    ['1500 DR', 150000, 'debit'],
    ['₹1,500.50 CR', 150050, 'credit']
  ] as const)('parses %s deterministically', (raw, amountMinor, direction) => {
    expect(parseMoney(raw)).toEqual({ amountMinor, direction, status: 'valid' })
  })

  it('rejects excess precision', () => {
    expect(parseMoney('10.001').status).toBe('excess_precision')
  })

  it('rejects simultaneous debit and credit values', () => {
    expect(parseSeparateDebitCredit('10.00', '10.00').status).toBe('invalid')
  })
})
