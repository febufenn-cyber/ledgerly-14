import { LedgerlyError } from './errors'
import type { AttemptStatus, ImportStatus } from './types'

const importTransitions: Record<ImportStatus, ReadonlySet<ImportStatus>> = {
  created: new Set(['uploading', 'cancelled']),
  uploading: new Set(['uploaded', 'failed', 'cancelled']),
  uploaded: new Set(['detecting', 'parsing', 'cancelled', 'quarantined']),
  detecting: new Set(['awaiting_mapping', 'parsing', 'failed', 'cancelled']),
  awaiting_mapping: new Set(['parsing', 'cancelled']),
  parsing: new Set(['staged', 'awaiting_confirmation', 'failed', 'cancelled']),
  staged: new Set(['awaiting_confirmation', 'committing', 'superseded', 'cancelled']),
  awaiting_confirmation: new Set(['committing', 'parsing', 'cancelled']),
  committing: new Set(['committed', 'committed_with_issues', 'failed']),
  committed: new Set([]),
  committed_with_issues: new Set([]),
  quarantined: new Set(['cancelled']),
  failed: new Set(['uploading', 'detecting', 'parsing', 'cancelled']),
  cancelled: new Set([]),
  superseded: new Set([])
}

const attemptTransitions: Record<AttemptStatus, ReadonlySet<AttemptStatus>> = {
  created: new Set(['running', 'failed']),
  running: new Set(['staged', 'failed']),
  staged: new Set(['committed', 'superseded', 'failed']),
  committed: new Set([]),
  failed: new Set([]),
  superseded: new Set([])
}

export function assertImportTransition(from: ImportStatus, to: ImportStatus): void {
  if (!importTransitions[from].has(to)) {
    throw new LedgerlyError(
      'IMPORT_CONCURRENT_MODIFICATION',
      `Invalid import transition: ${from} → ${to}`,
      409,
      { from, to }
    )
  }
}

export function assertAttemptTransition(from: AttemptStatus, to: AttemptStatus): void {
  if (!attemptTransitions[from].has(to)) {
    throw new LedgerlyError(
      'IMPORT_ATTEMPT_SUPERSEDED',
      `Invalid attempt transition: ${from} → ${to}`,
      409,
      { from, to }
    )
  }
}
