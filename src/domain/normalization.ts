import { candidateSimilarityKey, strongMovementIdentity } from './fingerprints'
import { parseDate } from './dates'
import { parseMoney, parseSeparateDebitCredit } from './money'
import type {
  CsvMapping,
  ImportManifest,
  NormalizedStagingRow,
  RawCsvRow,
  RowDisposition
} from './types'

export const PARSER_VERSION = 'generic-bank-csv-v1.0.0'
export const NORMALIZATION_VERSION = 'normalization-v1.0.0'

function field(row: RawCsvRow, index: number | undefined): string {
  if (index === undefined) return ''
  return row.fields[index]?.trim() ?? ''
}

function normalizeDescription(value: string): string {
  return value.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
}

function issueForMoney(status: ReturnType<typeof parseMoney>['status']): { code: string; message: string } {
  if (status === 'empty') return { code: 'ROW_NO_AMOUNT', message: 'No debit, credit, or signed amount was provided' }
  if (status === 'excess_precision') return { code: 'ROW_INVALID_AMOUNT', message: 'Amount has more than two decimal places' }
  if (status === 'unsafe_integer') return { code: 'ROW_INVALID_AMOUNT', message: 'Amount exceeds the supported safe integer range' }
  return { code: 'ROW_INVALID_AMOUNT', message: 'Amount could not be parsed deterministically' }
}

function dispositionForIssue(code: string): RowDisposition {
  if (code.startsWith('MAPPING_')) return 'needs_mapping'
  if (code === 'ROW_UNSUPPORTED_CURRENCY') return 'needs_review'
  return 'rejected'
}

export async function normalizeCsvRows(input: {
  organizationId: string
  financialAccountId: string
  rows: readonly RawCsvRow[]
  mapping: CsvMapping
  sourceFileSha256: string
}): Promise<NormalizedStagingRow[]> {
  const { mapping } = input
  const dataRows = input.rows.slice(mapping.headerRowIndex + 1).filter((row) => row.fields.some((value) => value.trim()))
  const normalized: NormalizedStagingRow[] = []

  for (const row of dataRows) {
    const descriptionOriginal = field(row, mapping.columns.description)
    const descriptionNormalized = normalizeDescription(descriptionOriginal)
    const posted = parseDate(field(row, mapping.columns.postedDate), mapping.dateFormat)
    const transactionDateRaw = field(row, mapping.columns.transactionDate)
    const transactionDate = transactionDateRaw ? parseDate(transactionDateRaw, mapping.dateFormat) : null

    let money
    if (mapping.directionStrategy === 'separate_debit_credit') {
      money = parseSeparateDebitCredit(field(row, mapping.columns.debit), field(row, mapping.columns.credit))
    } else if (mapping.directionStrategy === 'signed_amount') {
      money = parseMoney(field(row, mapping.columns.signedAmount))
    } else {
      const amount = field(row, mapping.columns.signedAmount)
      const directionRaw = field(row, mapping.columns.direction).toUpperCase()
      const debitLabels = new Set((mapping.debitLabels ?? ['DR', 'DEBIT', 'D', 'WITHDRAWAL']).map((value) => value.toUpperCase()))
      const creditLabels = new Set((mapping.creditLabels ?? ['CR', 'CREDIT', 'C', 'DEPOSIT']).map((value) => value.toUpperCase()))
      const direction = debitLabels.has(directionRaw) ? 'debit' : creditLabels.has(directionRaw) ? 'credit' : undefined
      money = direction ? parseMoney(amount, direction) : { amountMinor: null, direction: null, status: 'invalid' as const }
    }

    let issueCode: string | null = null
    let issueMessage: string | null = null
    if (posted.status !== 'valid') {
      issueCode = 'ROW_INVALID_DATE'
      issueMessage = `Posted date '${posted.raw}' is invalid for ${mapping.dateFormat}`
    } else if (transactionDate && transactionDate.status !== 'valid') {
      issueCode = 'ROW_INVALID_DATE'
      issueMessage = `Transaction date '${transactionDate.raw}' is invalid for ${mapping.dateFormat}`
    } else if (money.status !== 'valid') {
      const issue = issueForMoney(money.status)
      issueCode = issue.code
      issueMessage = issue.message
    } else if (mapping.currency !== 'INR') {
      issueCode = 'ROW_UNSUPPORTED_CURRENCY'
      issueMessage = `Currency ${mapping.currency} is preserved but unsupported in Phase 1`
    } else if (!descriptionOriginal) {
      issueCode = 'ROW_MALFORMED'
      issueMessage = 'Description is empty'
    }

    const externalReference = field(row, mapping.columns.reference) || null
    const counterpartyRaw = field(row, mapping.columns.counterparty) || null
    const balanceRaw = field(row, mapping.columns.balance)
    const balance = balanceRaw ? parseMoney(balanceRaw) : null
    const amountMinor = money.amountMinor
    const direction = money.direction
    const postedDate = posted.normalized
    const disposition = issueCode ? dispositionForIssue(issueCode) : 'normalized'

    const strongKey = await strongMovementIdentity({
      organizationId: input.organizationId,
      financialAccountId: input.financialAccountId,
      externalReference,
      postedDate,
      amountMinor,
      direction
    })
    const similarityKey = await candidateSimilarityKey({
      organizationId: input.organizationId,
      financialAccountId: input.financialAccountId,
      postedDate,
      amountMinor,
      direction,
      descriptionNormalized
    })

    normalized.push({
      physicalRowNumber: row.physicalRowNumber,
      rawText: row.rawText,
      rawFields: row.fields,
      postedDate,
      transactionDate: transactionDate?.normalized ?? null,
      descriptionOriginal,
      descriptionNormalized,
      amountMinor,
      currency: mapping.currency,
      direction,
      externalReference,
      counterpartyRaw,
      balanceAfterMinor: balance?.status === 'valid' ? balance.amountMinor : null,
      disposition,
      issueCode,
      issueMessage,
      strongIdentityKey: strongKey,
      candidateSimilarityKey: similarityKey
    })
  }

  return markWithinFileDuplicates(normalized)
}

export function markWithinFileDuplicates(rows: readonly NormalizedStagingRow[]): NormalizedStagingRow[] {
  const strongSeen = new Set<string>()
  const candidateSeen = new Set<string>()
  return rows.map((row) => {
    if (row.disposition !== 'normalized') return row
    if (row.strongIdentityKey) {
      if (strongSeen.has(row.strongIdentityKey)) {
        return {
          ...row,
          disposition: 'confirmed_duplicate',
          issueCode: 'ROW_POTENTIAL_DUPLICATE',
          issueMessage: 'A previous row in this file has the same strong external reference identity'
        }
      }
      strongSeen.add(row.strongIdentityKey)
      return row
    }
    if (row.candidateSimilarityKey) {
      if (candidateSeen.has(row.candidateSimilarityKey)) {
        return {
          ...row,
          disposition: 'potential_duplicate',
          issueCode: 'ROW_POTENTIAL_DUPLICATE',
          issueMessage: 'A previous row has the same date, amount, direction, and normalized description'
        }
      }
      candidateSeen.add(row.candidateSimilarityKey)
    }
    return row
  })
}

export function buildManifest(input: {
  importId: string
  sourceFileSha256: string
  rows: readonly NormalizedStagingRow[]
}): ImportManifest {
  const count = (disposition: RowDisposition) => input.rows.filter((row) => row.disposition === disposition).length
  const accounted = input.rows.length
  return {
    importId: input.importId,
    sourceFileSha256: input.sourceFileSha256,
    parserVersion: PARSER_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    physicalRows: accounted,
    normalized: count('normalized') + count('confirmed_unique'),
    potentialDuplicates: count('potential_duplicate'),
    confirmedDuplicates: count('confirmed_duplicate'),
    rejected: count('rejected'),
    needsMapping: count('needs_mapping'),
    needsReview: count('needs_review'),
    unaccounted: 0,
    totalDebitsMinor: input.rows
      .filter((row) => row.direction === 'debit' && row.amountMinor !== null)
      .reduce((sum, row) => sum + (row.amountMinor ?? 0), 0),
    totalCreditsMinor: input.rows
      .filter((row) => row.direction === 'credit' && row.amountMinor !== null)
      .reduce((sum, row) => sum + (row.amountMinor ?? 0), 0)
  }
}
