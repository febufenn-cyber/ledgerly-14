import { LedgerlyError } from '../domain/errors'
import type {
  CsvDetection,
  CsvMapping,
  ImportFileRecord,
  ImportManifest,
  ImportRecord,
  NormalizedStagingRow,
  SourceType
} from '../domain/types'
import { SupabaseRestClient } from './supabase'

interface OrganizationRecord {
  id: string
  name: string
  country_code: string
  functional_currency: string
  timezone: string
  created_at: string
}

interface FinancialAccountRecord {
  id: string
  organization_id: string
  name: string
  institution_name: string | null
  account_type: string
  currency: string
  masked_identifier: string | null
  status: string
}

export class LedgerlyRepository {
  constructor(private readonly db: SupabaseRestClient) {}

  async createOrganization(input: {
    name: string
    userId: string
    timezone: string
  }): Promise<OrganizationRecord> {
    return this.db.table<OrganizationRecord>('organizations', {
      method: 'POST',
      body: {
        name: input.name,
        country_code: 'IN',
        functional_currency: 'INR',
        timezone: input.timezone,
        created_by: input.userId
      },
      prefer: 'return=representation',
      single: true
    })
  }

  async createFinancialAccount(input: {
    organizationId: string
    name: string
    institutionName: string | null
    accountType: string
    currency: string
    maskedIdentifier: string | null
    userId: string
  }): Promise<FinancialAccountRecord> {
    return this.db.table<FinancialAccountRecord>('financial_accounts', {
      method: 'POST',
      body: {
        organization_id: input.organizationId,
        name: input.name,
        institution_name: input.institutionName,
        account_type: input.accountType,
        currency: input.currency,
        masked_identifier: input.maskedIdentifier,
        created_by: input.userId
      },
      prefer: 'return=representation',
      single: true
    })
  }

  async createImport(input: {
    organizationId: string
    financialAccountId: string
    sourceType: SourceType
    originalFilename: string
    userId: string
  }): Promise<ImportRecord> {
    return this.db.table<ImportRecord>('imports', {
      method: 'POST',
      body: {
        organization_id: input.organizationId,
        financial_account_id: input.financialAccountId,
        source_type: input.sourceType,
        original_filename: input.originalFilename,
        status: 'created',
        created_by: input.userId
      },
      prefer: 'return=representation',
      single: true
    })
  }

  async getImport(importId: string): Promise<ImportRecord> {
    const rows = await this.db.table<ImportRecord[]>('imports', {
      query: { id: `eq.${importId}`, select: '*' }
    })
    const item = rows[0]
    if (!item) throw new LedgerlyError('NOT_FOUND', 'Import not found', 404)
    return item
  }

  async getImportFile(importId: string): Promise<ImportFileRecord> {
    const rows = await this.db.table<ImportFileRecord[]>('import_files', {
      query: { import_id: `eq.${importId}`, select: '*', order: 'uploaded_at.desc', limit: '1' }
    })
    const item = rows[0]
    if (!item) throw new LedgerlyError('NOT_FOUND', 'Import source file not found', 404)
    return item
  }

  async findDuplicateFile(input: {
    organizationId: string
    financialAccountId: string
    sha256: string
  }): Promise<ImportFileRecord | null> {
    const rows = await this.db.table<ImportFileRecord[]>('import_files', {
      query: {
        organization_id: `eq.${input.organizationId}`,
        financial_account_id: `eq.${input.financialAccountId}`,
        sha256: `eq.${input.sha256}`,
        select: '*',
        limit: '1'
      }
    })
    return rows[0] ?? null
  }

  async attachFile(input: {
    importRecord: ImportRecord
    storageObjectKey: string
    sha256: string
    byteSize: number
    contentTypeClaimed: string | null
    contentTypeDetected: string
    encodingDetected: string | null
    lineEnding: string | null
    userId: string
  }): Promise<ImportFileRecord> {
    const file = await this.db.table<ImportFileRecord>('import_files', {
      method: 'POST',
      body: {
        import_id: input.importRecord.id,
        organization_id: input.importRecord.organization_id,
        financial_account_id: input.importRecord.financial_account_id,
        storage_object_key: input.storageObjectKey,
        original_filename: input.importRecord.original_filename,
        content_type_claimed: input.contentTypeClaimed,
        content_type_detected: input.contentTypeDetected,
        byte_size: input.byteSize,
        sha256: input.sha256,
        encoding_detected: input.encodingDetected,
        line_ending: input.lineEnding,
        uploaded_by: input.userId
      },
      prefer: 'return=representation',
      single: true
    })
    await this.updateImportStatus(input.importRecord.id, 'uploaded')
    return file
  }

  async saveDetection(importId: string, detection: CsvDetection): Promise<void> {
    await this.db.table('imports', {
      method: 'PATCH',
      query: { id: `eq.${importId}` },
      body: { detection_json: detection, status: 'awaiting_mapping' },
      prefer: 'return=minimal'
    })
  }

  async stageAttempt(input: {
    importId: string
    mapping: CsvMapping
    parserVersion: string
    normalizationVersion: string
    sourceFileSha256: string
    rows: NormalizedStagingRow[]
    manifest: ImportManifest
  }): Promise<{ attempt_id: string }> {
    return this.db.rpc<{ attempt_id: string }>('stage_import_attempt', {
      p_import_id: input.importId,
      p_mapping: input.mapping,
      p_parser_version: input.parserVersion,
      p_normalization_version: input.normalizationVersion,
      p_source_file_sha256: input.sourceFileSha256,
      p_rows: input.rows,
      p_manifest: input.manifest
    })
  }

  async getAttemptPreview(importId: string): Promise<unknown> {
    return this.db.rpc('get_import_preview', { p_import_id: importId })
  }

  async commitAttempt(importId: string, attemptId: string): Promise<unknown> {
    return this.db.rpc('commit_import_attempt', {
      p_import_id: importId,
      p_attempt_id: attemptId
    })
  }

  async updateImportStatus(importId: string, status: ImportRecord['status']): Promise<void> {
    await this.db.table('imports', {
      method: 'PATCH',
      query: { id: `eq.${importId}` },
      body: { status },
      prefer: 'return=minimal'
    })
  }
}
