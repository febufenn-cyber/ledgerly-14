export type LedgerlyErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'IMPORT_FILE_TOO_LARGE'
  | 'IMPORT_EMPTY_FILE'
  | 'IMPORT_BINARY_FILE'
  | 'IMPORT_UNSUPPORTED_ENCODING'
  | 'IMPORT_UNSUPPORTED_DELIMITER'
  | 'IMPORT_DUPLICATE_FILE'
  | 'IMPORT_STORAGE_INTEGRITY_FAILED'
  | 'MAPPING_DATE_COLUMN_MISSING'
  | 'MAPPING_DESCRIPTION_COLUMN_MISSING'
  | 'MAPPING_AMOUNT_COLUMN_MISSING'
  | 'MAPPING_DIRECTION_UNRESOLVED'
  | 'MAPPING_AMBIGUOUS_DATE_FORMAT'
  | 'MAPPING_CONFLICTING_AMOUNT_COLUMNS'
  | 'ROW_INVALID_DATE'
  | 'ROW_INVALID_AMOUNT'
  | 'ROW_BOTH_DEBIT_AND_CREDIT'
  | 'ROW_NO_AMOUNT'
  | 'ROW_UNSUPPORTED_CURRENCY'
  | 'ROW_FIELD_TOO_LONG'
  | 'ROW_POTENTIAL_DUPLICATE'
  | 'ROW_MALFORMED'
  | 'IMPORT_NOT_READY'
  | 'IMPORT_ALREADY_COMMITTED'
  | 'IMPORT_ATTEMPT_SUPERSEDED'
  | 'IMPORT_CONCURRENT_MODIFICATION'
  | 'IMPORT_UNACCOUNTED_ROWS'
  | 'IMPORT_COMMIT_FAILED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'

export class LedgerlyError extends Error {
  readonly code: LedgerlyErrorCode
  readonly status: number
  readonly details: Record<string, unknown> | undefined

  constructor(
    code: LedgerlyErrorCode,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'LedgerlyError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function asLedgerlyError(error: unknown): LedgerlyError {
  if (error instanceof LedgerlyError) return error
  return new LedgerlyError('INTERNAL_ERROR', 'An unexpected error occurred', 500)
}
