import { LedgerlyError } from './errors'
import type { CsvDetection, CsvMapping } from './types'

function find(headers: readonly string[], patterns: readonly RegExp[]): number | undefined {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header.trim().toLowerCase())))
  return index >= 0 ? index : undefined
}

export function suggestMapping(detection: CsvDetection): Partial<CsvMapping> {
  const headers = detection.headers
  const postedDate = find(headers, [/^date$/, /posted.*date/, /transaction.*date/, /value.*date/])
  const description = find(headers, [/description/, /narration/, /particular/, /details/, /remarks/])
  const reference = find(headers, [/reference/, /ref\.?\s*no/, /transaction.*id/, /utr/])
  const debit = find(headers, [/debit/, /withdrawal/, /amount.*dr/])
  const credit = find(headers, [/credit/, /deposit/, /amount.*cr/])
  const signedAmount = find(headers, [/^amount$/, /transaction.*amount/])
  const direction = find(headers, [/type/, /dr.*cr/, /direction/])
  const balance = find(headers, [/balance/])

  const directionStrategy = debit !== undefined || credit !== undefined
    ? 'separate_debit_credit'
    : direction !== undefined
      ? 'amount_and_type'
      : 'signed_amount'

  const columns: CsvMapping['columns'] = {
    postedDate: postedDate ?? -1,
    description: description ?? -1
  }
  if (reference !== undefined) columns.reference = reference
  if (debit !== undefined) columns.debit = debit
  if (credit !== undefined) columns.credit = credit
  if (signedAmount !== undefined) columns.signedAmount = signedAmount
  if (direction !== undefined) columns.direction = direction
  if (balance !== undefined) columns.balance = balance

  const suggested: Partial<CsvMapping> = {
    headerRowIndex: detection.headerRowIndex,
    delimiter: detection.delimiter,
    currency: 'INR',
    columns,
    directionStrategy
  }
  const dateFormat = detection.dateFormatCandidates.length === 1 ? detection.dateFormatCandidates[0] : undefined
  if (dateFormat) suggested.dateFormat = dateFormat
  return suggested
}

export function validateMapping(mapping: CsvMapping): void {
  if (mapping.columns.postedDate < 0) {
    throw new LedgerlyError('MAPPING_DATE_COLUMN_MISSING', 'A posted-date column is required')
  }
  if (mapping.columns.description < 0) {
    throw new LedgerlyError('MAPPING_DESCRIPTION_COLUMN_MISSING', 'A description column is required')
  }
  if (mapping.directionStrategy === 'separate_debit_credit') {
    if (mapping.columns.debit === undefined && mapping.columns.credit === undefined) {
      throw new LedgerlyError('MAPPING_AMOUNT_COLUMN_MISSING', 'Debit or credit column is required')
    }
  } else if (mapping.columns.signedAmount === undefined) {
    throw new LedgerlyError('MAPPING_AMOUNT_COLUMN_MISSING', 'An amount column is required')
  }
  if (mapping.directionStrategy === 'amount_and_type' && mapping.columns.direction === undefined) {
    throw new LedgerlyError('MAPPING_DIRECTION_UNRESOLVED', 'A type/direction column is required')
  }
}
