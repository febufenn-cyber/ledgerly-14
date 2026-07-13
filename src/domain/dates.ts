import type { DateFormat } from './types'

export interface ParsedDate {
  raw: string
  format: DateFormat
  normalized: string | null
  status: 'valid' | 'invalid' | 'ambiguous'
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function iso(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`
}

export function parseDate(rawValue: string, format: DateFormat): ParsedDate {
  const raw = rawValue.trim()
  if (!raw) return { raw, format, normalized: null, status: 'invalid' }
  const delimiter = format.includes('/') ? '/' : '-'
  const parts = raw.split(delimiter).map(Number)
  if (parts.length !== 3 || parts.some((value) => !Number.isInteger(value))) {
    return { raw, format, normalized: null, status: 'invalid' }
  }

  let year: number
  let month: number
  let day: number
  if (format === 'YYYY-MM-DD') {
    ;[year, month, day] = parts as [number, number, number]
  } else if (format.startsWith('DD')) {
    ;[day, month, year] = parts as [number, number, number]
  } else {
    ;[month, day, year] = parts as [number, number, number]
  }

  if (!validDate(year, month, day)) return { raw, format, normalized: null, status: 'invalid' }
  return { raw, format, normalized: iso(year, month, day), status: 'valid' }
}
