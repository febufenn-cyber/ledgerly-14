export type UUID = string

export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'founder_reviewer'
  | 'accountant_reviewer'
  | 'read_only_auditor'

export type SourceType = 'bank_csv' | 'stripe_csv' | 'razorpay_csv' | 'manual'
export type ImportStatus =
  | 'created'
  | 'uploading'
  | 'uploaded'
  | 'detecting'
  | 'awaiting_mapping'
  | 'parsing'
  | 'staged'
  | 'awaiting_confirmation'
  | 'committing'
  | 'committed'
  | 'committed_with_issues'
  | 'quarantined'
  | 'failed'
  | 'cancelled'
  | 'superseded'

export type AttemptStatus = 'created' | 'running' | 'staged' | 'committed' | 'failed' | 'superseded'
export type Direction = 'debit' | 'credit'
export type RowDisposition =
  | 'normalized'
  | 'needs_mapping'
  | 'potential_duplicate'
  | 'confirmed_duplicate'
  | 'confirmed_unique'
  | 'rejected'
  | 'needs_review'

export interface AuthenticatedUser {
  id: UUID
  email: string | null
  accessToken: string
}

export interface ImportRecord {
  id: UUID
  organization_id: UUID
  financial_account_id: UUID
  source_type: SourceType
  original_filename: string
  status: ImportStatus
  committed_attempt_id: UUID | null
  created_by: UUID
  created_at: string
}

export interface ImportFileRecord {
  id: UUID
  import_id: UUID
  organization_id: UUID
  financial_account_id: UUID
  storage_object_key: string
  original_filename: string
  content_type_claimed: string | null
  content_type_detected: string
  byte_size: number
  sha256: string
  encoding_detected: string | null
  line_ending: string | null
  uploaded_by: UUID
  uploaded_at: string
}

export interface CsvDetection {
  encoding: 'utf-8' | 'windows-1252'
  delimiter: ',' | ';' | '\t' | '|'
  headerRowIndex: number
  dataStartRowIndex: number
  columnCount: number
  headers: string[]
  dateFormatCandidates: DateFormat[]
  warnings: string[]
}

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'MM-DD-YYYY'

export interface CsvMapping {
  headerRowIndex: number
  delimiter: ',' | ';' | '\t' | '|'
  dateFormat: DateFormat
  currency: string
  columns: {
    postedDate: number
    transactionDate?: number
    description: number
    reference?: number
    debit?: number
    credit?: number
    signedAmount?: number
    direction?: number
    balance?: number
    counterparty?: number
  }
  directionStrategy: 'separate_debit_credit' | 'signed_amount' | 'amount_and_type'
  debitLabels?: string[]
  creditLabels?: string[]
}

export interface RawCsvRow {
  physicalRowNumber: number
  rawText: string
  fields: string[]
}

export interface NormalizedStagingRow {
  physicalRowNumber: number
  rawText: string
  rawFields: string[]
  postedDate: string | null
  transactionDate: string | null
  descriptionOriginal: string
  descriptionNormalized: string
  amountMinor: number | null
  currency: string
  direction: Direction | null
  externalReference: string | null
  counterpartyRaw: string | null
  balanceAfterMinor: number | null
  disposition: RowDisposition
  issueCode: string | null
  issueMessage: string | null
  strongIdentityKey: string | null
  candidateSimilarityKey: string | null
}

export interface ImportManifest {
  importId: UUID
  attemptId?: UUID
  sourceFileSha256: string
  parserVersion: string
  normalizationVersion: string
  physicalRows: number
  normalized: number
  potentialDuplicates: number
  confirmedDuplicates: number
  rejected: number
  needsMapping: number
  needsReview: number
  unaccounted: number
  totalDebitsMinor: number
  totalCreditsMinor: number
}

export interface DetectionPreview {
  detection: CsvDetection
  rows: Array<{ raw: string[]; rowNumber: number }>
}
