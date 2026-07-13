import type { Direction } from './types'

export interface ParsedMoney {
  amountMinor: number | null
  direction: Direction | null
  status:
    | 'valid'
    | 'empty'
    | 'invalid'
    | 'excess_precision'
    | 'unsafe_integer'
}

function normalizeNumeric(raw: string): { value: string; negative: boolean } {
  let value = raw.trim()
  let negative = false
  if (/^\(.*\)$/.test(value)) {
    negative = true
    value = value.slice(1, -1)
  }
  if (value.startsWith('-')) {
    negative = true
    value = value.slice(1)
  } else if (value.startsWith('+')) {
    value = value.slice(1)
  }
  value = value
    .replace(/[₹$€£]/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/(?:DR|CR)$/i, '')
  return { value, negative }
}

export function parseMoney(raw: string, defaultDirection?: Direction): ParsedMoney {
  if (!raw.trim()) return { amountMinor: null, direction: null, status: 'empty' }
  const suffix = raw.match(/(DR|CR)\s*$/i)?.[1]?.toUpperCase()
  const { value, negative } = normalizeNumeric(raw)
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return { amountMinor: null, direction: null, status: 'invalid' }
  }
  const [whole = '', fraction = ''] = value.split('.')
  if (fraction.length > 2) {
    return { amountMinor: null, direction: null, status: 'excess_precision' }
  }
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(amountMinor)) {
    return { amountMinor: null, direction: null, status: 'unsafe_integer' }
  }
  const direction: Direction = suffix === 'DR' || negative ? 'debit' : suffix === 'CR' ? 'credit' : defaultDirection ?? 'credit'
  return { amountMinor, direction, status: 'valid' }
}

export function parseSeparateDebitCredit(debitRaw: string, creditRaw: string): ParsedMoney {
  const debit = parseMoney(debitRaw, 'debit')
  const credit = parseMoney(creditRaw, 'credit')
  const hasDebit = debit.status !== 'empty'
  const hasCredit = credit.status !== 'empty'
  if (hasDebit && hasCredit) return { amountMinor: null, direction: null, status: 'invalid' }
  if (!hasDebit && !hasCredit) return { amountMinor: null, direction: null, status: 'empty' }
  return hasDebit ? debit : credit
}
