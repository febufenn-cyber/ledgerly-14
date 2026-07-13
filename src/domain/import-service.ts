import { decodeCsvBytes, detectCsv, parseCsvRows } from './csv'
import { LedgerlyError } from './errors'
import { sha256Bytes } from './fingerprints'
import { validateMapping } from './mapping'
import {
  buildManifest,
  NORMALIZATION_VERSION,
  normalizeCsvRows,
  PARSER_VERSION
} from './normalization'
import type { CsvMapping, DetectionPreview, ImportFileRecord, ImportRecord } from './types'
import { LedgerlyRepository } from '../infra/repository'

export interface SourceObjectStore {
  put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}

export class ImportService {
  constructor(
    private readonly repository: LedgerlyRepository,
    private readonly store: SourceObjectStore,
    private readonly maxUploadBytes: number
  ) {}

  async uploadSource(input: {
    importRecord: ImportRecord
    bytes: Uint8Array
    contentTypeClaimed: string | null
    userId: string
  }): Promise<ImportFileRecord> {
    if (!['created', 'uploading', 'failed'].includes(input.importRecord.status)) {
      throw new LedgerlyError(
        'IMPORT_NOT_READY',
        `Import ${input.importRecord.id} cannot accept a source file while ${input.importRecord.status}`,
        409
      )
    }
    if (input.bytes.byteLength === 0) throw new LedgerlyError('IMPORT_EMPTY_FILE', 'The uploaded file is empty')
    if (input.bytes.byteLength > this.maxUploadBytes) {
      throw new LedgerlyError('IMPORT_FILE_TOO_LARGE', 'The uploaded CSV exceeds the configured size limit', 413, {
        maximumBytes: this.maxUploadBytes,
        actualBytes: input.bytes.byteLength
      })
    }
    const decoded = decodeCsvBytes(input.bytes)
    const sha256 = await sha256Bytes(input.bytes)
    const existing = await this.repository.findDuplicateFile({
      organizationId: input.importRecord.organization_id,
      financialAccountId: input.importRecord.financial_account_id,
      sha256
    })
    if (existing) {
      throw new LedgerlyError('IMPORT_DUPLICATE_FILE', 'This exact file was already uploaded for this account', 409, {
        priorImportId: existing.import_id
      })
    }

    const objectKey = `organizations/${input.importRecord.organization_id}/imports/${input.importRecord.id}/${sha256}.csv`
    await this.store.put(objectKey, input.bytes, { contentType: 'text/csv', sha256 })
    try {
      return await this.repository.attachFile({
        importRecord: input.importRecord,
        storageObjectKey: objectKey,
        sha256,
        byteSize: input.bytes.byteLength,
        contentTypeClaimed: input.contentTypeClaimed,
        contentTypeDetected: 'text/csv',
        encodingDetected: decoded.encoding,
        lineEnding: decoded.lineEnding,
        userId: input.userId
      })
    } catch (error) {
      await this.store.delete(objectKey)
      throw error
    }
  }

  async detect(importId: string): Promise<DetectionPreview> {
    const file = await this.repository.getImportFile(importId)
    const bytes = await this.requireObject(file.storage_object_key)
    const decoded = decodeCsvBytes(bytes)
    const detection = detectCsv(decoded.text, decoded.encoding)
    const rows = parseCsvRows(decoded.text, detection.delimiter)
    await this.repository.saveDetection(importId, detection)
    return {
      detection,
      rows: rows.slice(detection.dataStartRowIndex, detection.dataStartRowIndex + 10).map((row) => ({
        raw: row.fields,
        rowNumber: row.physicalRowNumber
      }))
    }
  }

  async stage(input: {
    importRecord: ImportRecord
    mapping: CsvMapping
  }): Promise<{ attemptId: string; manifest: ReturnType<typeof buildManifest> }> {
    validateMapping(input.mapping)
    const file = await this.repository.getImportFile(input.importRecord.id)
    const bytes = await this.requireObject(file.storage_object_key)
    const decoded = decodeCsvBytes(bytes)
    const rows = parseCsvRows(decoded.text, input.mapping.delimiter)
    const normalized = await normalizeCsvRows({
      organizationId: input.importRecord.organization_id,
      financialAccountId: input.importRecord.financial_account_id,
      rows,
      mapping: input.mapping,
      sourceFileSha256: file.sha256
    })
    const manifest = buildManifest({
      importId: input.importRecord.id,
      sourceFileSha256: file.sha256,
      rows: normalized
    })
    if (manifest.unaccounted !== 0) {
      throw new LedgerlyError('IMPORT_UNACCOUNTED_ROWS', 'Every source row must receive a disposition', 409)
    }
    const result = await this.repository.stageAttempt({
      importId: input.importRecord.id,
      mapping: input.mapping,
      parserVersion: PARSER_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      sourceFileSha256: file.sha256,
      rows: normalized,
      manifest
    })
    return { attemptId: result.attempt_id, manifest: { ...manifest, attemptId: result.attempt_id } }
  }

  private async requireObject(key: string): Promise<Uint8Array> {
    const value = await this.store.get(key)
    if (!value) throw new LedgerlyError('IMPORT_STORAGE_INTEGRITY_FAILED', 'The source object is missing', 409)
    return value
  }
}
