import { LedgerlyError } from './errors'
import type { CsvDetection, RawCsvRow } from './types'

const DELIMITERS = [',', ';', '\t', '|'] as const
const HEADER_HINTS = [
  'date',
  'transaction date',
  'posted date',
  'description',
  'narration',
  'particulars',
  'reference',
  'debit',
  'withdrawal',
  'credit',
  'deposit',
  'amount',
  'balance'
]

export interface DecodedCsv {
  text: string
  encoding: 'utf-8' | 'windows-1252'
  lineEnding: 'CRLF' | 'LF' | 'CR' | 'mixed' | 'none'
}

export function detectLineEnding(text: string): DecodedCsv['lineEnding'] {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const withoutCrlf = text.replace(/\r\n/g, '')
  const lf = (withoutCrlf.match(/\n/g) ?? []).length
  const cr = (withoutCrlf.match(/\r/g) ?? []).length
  const kinds = Number(crlf > 0) + Number(lf > 0) + Number(cr > 0)
  if (kinds === 0) return 'none'
  if (kinds > 1) return 'mixed'
  if (crlf > 0) return 'CRLF'
  if (lf > 0) return 'LF'
  return 'CR'
}

export function decodeCsvBytes(bytes: Uint8Array): DecodedCsv {
  if (bytes.length === 0) {
    throw new LedgerlyError('IMPORT_EMPTY_FILE', 'The uploaded file is empty')
  }
  if (bytes.includes(0)) {
    throw new LedgerlyError('IMPORT_BINARY_FILE', 'The uploaded file contains binary NUL bytes')
  }

  const payload = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.slice(3) : bytes
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payload)
    return { text, encoding: 'utf-8', lineEnding: detectLineEnding(text) }
  } catch {
    try {
      const text = new TextDecoder('windows-1252', { fatal: true }).decode(payload)
      return { text, encoding: 'windows-1252', lineEnding: detectLineEnding(text) }
    } catch {
      throw new LedgerlyError(
        'IMPORT_UNSUPPORTED_ENCODING',
        'Only UTF-8 and Windows-1252 CSV files are supported'
      )
    }
  }
}

export function parseCsvRows(text: string, delimiter: string): RawCsvRow[] {
  const rows: RawCsvRow[] = []
  let fields: string[] = []
  let field = ''
  let raw = ''
  let quoted = false
  let rowNumber = 1

  const commitField = () => {
    fields.push(field)
    field = ''
  }
  const commitRow = () => {
    commitField()
    if (raw.trim().length > 0 || fields.some((value) => value.length > 0)) {
      rows.push({ physicalRowNumber: rowNumber, rawText: raw, fields })
    }
    fields = []
    raw = ''
    rowNumber += 1
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? ''
    const next = text[index + 1] ?? ''

    if (quoted) {
      raw += char
      if (char === '"' && next === '"') {
        field += '"'
        raw += next
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      quoted = true
      raw += char
    } else if (char === delimiter) {
      raw += char
      commitField()
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && next === '\n') index += 1
      commitRow()
    } else {
      field += char
      raw += char
    }
  }

  if (quoted) {
    throw new LedgerlyError('ROW_MALFORMED', 'CSV contains an unclosed quoted field')
  }
  if (field.length > 0 || fields.length > 0 || raw.length > 0) commitRow()
  return rows
}

function scoreDelimiter(text: string, delimiter: string): { score: number; modeColumns: number } {
  let rows: RawCsvRow[]
  try {
    rows = parseCsvRows(text, delimiter).filter((row) => row.fields.some((field) => field.trim() !== '')).slice(0, 30)
  } catch {
    return { score: -1, modeColumns: 0 }
  }
  if (rows.length < 2) return { score: -1, modeColumns: 0 }

  const counts = new Map<number, number>()
  for (const row of rows) counts.set(row.fields.length, (counts.get(row.fields.length) ?? 0) + 1)
  const [modeColumns, frequency] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
  if (modeColumns < 2) return { score: -1, modeColumns }
  return { score: frequency * 10 + modeColumns, modeColumns }
}

export function detectDelimiter(text: string): (typeof DELIMITERS)[number] {
  const ranked = DELIMITERS.map((delimiter) => ({ delimiter, ...scoreDelimiter(text, delimiter) })).sort(
    (a, b) => b.score - a.score
  )
  const best = ranked[0]
  if (!best || best.score < 0) {
    throw new LedgerlyError('IMPORT_UNSUPPORTED_DELIMITER', 'Could not detect a consistent CSV delimiter')
  }
  return best.delimiter
}

function headerScore(fields: readonly string[]): number {
  return fields.reduce((score, field) => {
    const normalized = field.trim().toLowerCase()
    return score + (HEADER_HINTS.some((hint) => normalized === hint || normalized.includes(hint)) ? 1 : 0)
  }, 0)
}

function detectDateCandidates(rows: readonly RawCsvRow[], dateColumn: number): CsvDetection['dateFormatCandidates'] {
  const values = rows
    .map((row) => row.fields[dateColumn]?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 20)
  const candidates = new Set<CsvDetection['dateFormatCandidates'][number]>()
  for (const value of values) {
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) candidates.add('YYYY-MM-DD')
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const [first = 0, second = 0] = value.split('/').map(Number)
      if (first > 12) candidates.add('DD/MM/YYYY')
      else if (second > 12) candidates.add('MM/DD/YYYY')
      else {
        candidates.add('DD/MM/YYYY')
        candidates.add('MM/DD/YYYY')
      }
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
      const [first = 0, second = 0] = value.split('-').map(Number)
      if (first > 12) candidates.add('DD-MM-YYYY')
      else if (second > 12) candidates.add('MM-DD-YYYY')
      else {
        candidates.add('DD-MM-YYYY')
        candidates.add('MM-DD-YYYY')
      }
    }
  }
  return [...candidates]
}

export function detectCsv(text: string, encoding: CsvDetection['encoding']): CsvDetection {
  const delimiter = detectDelimiter(text)
  const rows = parseCsvRows(text, delimiter)
  const candidates = rows.slice(0, 20).map((row, index) => ({ index, row, score: headerScore(row.fields) }))
  const best = candidates.sort((a, b) => b.score - a.score)[0]
  if (!best || best.score < 2) {
    throw new LedgerlyError('MAPPING_DESCRIPTION_COLUMN_MISSING', 'Could not confidently locate the CSV header row')
  }

  const headers = best.row.fields.map((field) => field.trim())
  const dateColumn = headers.findIndex((header) => /date/i.test(header))
  const dataRows = rows.slice(best.index + 1)
  const dateFormatCandidates = dateColumn >= 0 ? detectDateCandidates(dataRows, dateColumn) : []
  const warnings: string[] = []
  if (dateFormatCandidates.length > 1) warnings.push('MAPPING_AMBIGUOUS_DATE_FORMAT')

  return {
    encoding,
    delimiter,
    headerRowIndex: best.index,
    dataStartRowIndex: best.index + 1,
    columnCount: headers.length,
    headers,
    dateFormatCandidates,
    warnings
  }
}
