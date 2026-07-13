import { describe, expect, it } from 'vitest'
import { decodeCsvBytes, detectCsv, parseCsvRows } from '../src/domain/csv'
import { suggestMapping } from '../src/domain/mapping'

describe('CSV detection', () => {
  const source = [
    'HDFC Bank Statement',
    'Account,XXXX1234',
    '',
    'Date,Narration,Withdrawal,Deposit,Reference',
    '03/04/2026,"FIGMA, MONTHLY",1200.00,,ABC-1',
    '05/04/2026,CLIENT PAYMENT,,95000.00,UTR-9'
  ].join('\r\n')

  it('detects encoding, delimiter, header, and ambiguous date formats', () => {
    const decoded = decodeCsvBytes(new TextEncoder().encode(source))
    const detection = detectCsv(decoded.text, decoded.encoding)
    expect(decoded.lineEnding).toBe('CRLF')
    expect(detection.delimiter).toBe(',')
    expect(detection.headerRowIndex).toBe(2)
    expect(detection.headers).toContain('Narration')
    expect(detection.dateFormatCandidates).toEqual(expect.arrayContaining(['DD/MM/YYYY', 'MM/DD/YYYY']))
    expect(detection.warnings).toContain('MAPPING_AMBIGUOUS_DATE_FORMAT')
  })

  it('parses quoted commas without shifting columns', () => {
    const rows = parseCsvRows(source, ',')
    expect(rows[3]?.fields[1]).toBe('FIGMA, MONTHLY')
    expect(rows[3]?.fields).toHaveLength(5)
  })

  it('suggests safe column roles but does not guess an ambiguous date format', () => {
    const decoded = decodeCsvBytes(new TextEncoder().encode(source))
    const mapping = suggestMapping(detectCsv(decoded.text, decoded.encoding))
    expect(mapping.columns?.postedDate).toBe(0)
    expect(mapping.columns?.description).toBe(1)
    expect(mapping.directionStrategy).toBe('separate_debit_credit')
    expect(mapping.dateFormat).toBeUndefined()
  })
})
