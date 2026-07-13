import { describe, expect, it, vi } from 'vitest'
import { ImportService, type SourceObjectStore } from '../src/domain/import-service'
import { LedgerlyError } from '../src/domain/errors'
import type { ImportRecord } from '../src/domain/types'
import type { LedgerlyRepository } from '../src/infra/repository'

const importRecord: ImportRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  organization_id: '22222222-2222-4222-8222-222222222222',
  financial_account_id: '33333333-3333-4333-8333-333333333333',
  source_type: 'bank_csv',
  original_filename: 'statement.csv',
  status: 'created',
  committed_attempt_id: null,
  created_by: '44444444-4444-4444-8444-444444444444',
  created_at: '2026-07-13T00:00:00Z'
}

function store(): SourceObjectStore & { values: Map<string, Uint8Array> } {
  const values = new Map<string, Uint8Array>()
  return {
    values,
    async put(key, bytes) { values.set(key, bytes) },
    async get(key) { return values.get(key) ?? null },
    async delete(key) { values.delete(key) }
  }
}

describe('ImportService upload', () => {
  it('rolls back the R2 object when database attachment fails', async () => {
    const objectStore = store()
    const repository = {
      findDuplicateFile: vi.fn().mockResolvedValue(null),
      attachFile: vi.fn().mockRejectedValue(new Error('database unavailable'))
    } as unknown as LedgerlyRepository
    const service = new ImportService(repository, objectStore, 1024)

    await expect(service.uploadSource({
      importRecord,
      bytes: new TextEncoder().encode('Date,Description,Debit\n01/01/2026,Test,10'),
      contentTypeClaimed: 'text/csv',
      userId: importRecord.created_by
    })).rejects.toThrow('database unavailable')
    expect(objectStore.values.size).toBe(0)
  })

  it('rejects exact file duplication before storing another object', async () => {
    const objectStore = store()
    const repository = {
      findDuplicateFile: vi.fn().mockResolvedValue({ import_id: 'prior-import' })
    } as unknown as LedgerlyRepository
    const service = new ImportService(repository, objectStore, 1024)

    await expect(service.uploadSource({
      importRecord,
      bytes: new TextEncoder().encode('Date,Description,Debit\n01/01/2026,Test,10'),
      contentTypeClaimed: 'text/csv',
      userId: importRecord.created_by
    })).rejects.toMatchObject({ code: 'IMPORT_DUPLICATE_FILE' } satisfies Partial<LedgerlyError>)
    expect(objectStore.values.size).toBe(0)
  })

  it('uses a content-addressed key and refuses to overwrite an advanced import', async () => {
    const objectStore = store()
    const attachFile = vi.fn().mockResolvedValue({ import_id: importRecord.id })
    const repository = {
      findDuplicateFile: vi.fn().mockResolvedValue(null),
      attachFile
    } as unknown as LedgerlyRepository
    const service = new ImportService(repository, objectStore, 1024)
    const bytes = new TextEncoder().encode('Date,Description,Debit\n01/01/2026,Test,10')

    await service.uploadSource({
      importRecord,
      bytes,
      contentTypeClaimed: 'text/csv',
      userId: importRecord.created_by
    })
    const [key] = [...objectStore.values.keys()]
    expect(key).toMatch(/organizations\/[^/]+\/imports\/[^/]+\/[0-9a-f]{64}\.csv$/)

    await expect(service.uploadSource({
      importRecord: { ...importRecord, status: 'uploaded' },
      bytes,
      contentTypeClaimed: 'text/csv',
      userId: importRecord.created_by
    })).rejects.toMatchObject({ code: 'IMPORT_NOT_READY' } satisfies Partial<LedgerlyError>)
    expect(attachFile).toHaveBeenCalledTimes(1)
  })
})
