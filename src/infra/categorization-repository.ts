import type {
  CategorizationCandidate,
  CategorizationRule,
  CorrectionRequest,
  RulePredicate,
  RuleSuggestion,
  StoredRuleScope
} from '../domain/categorization-types'
import { LedgerlyError } from '../domain/errors'
import { SupabaseRestClient } from './supabase'

export interface CanonicalCategoryRecord {
  code: string
  label: string
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  risk: 'low' | 'medium' | 'high'
  active: boolean
}

export interface CategoryMappingRecord {
  id: string
  organization_id: string
  canonical_category_code: string
  account_name: string
  external_account_code: string | null
  active: boolean
}

interface TransactionRow {
  id: string
  organization_id: string
  financial_account_id: string
  posted_date: string
  description_original: string
  description_normalized: string
  amount_minor: number
  currency: string
  direction: 'debit' | 'credit'
  external_reference: string | null
  counterparty_raw: string | null
}

export class CategorizationRepository {
  constructor(private readonly db: SupabaseRestClient) {}

  async listCategories(): Promise<CanonicalCategoryRecord[]> {
    return this.db.table<CanonicalCategoryRecord[]>('canonical_categories', {
      query: { active: 'eq.true', select: '*', order: 'account_type.asc,code.asc' }
    })
  }

  async listMappings(organizationId: string): Promise<CategoryMappingRecord[]> {
    return this.db.table<CategoryMappingRecord[]>('organization_category_mappings', {
      query: { organization_id: `eq.${organizationId}`, active: 'eq.true', select: '*', order: 'account_name.asc' }
    })
  }

  async upsertMapping(input: {
    organizationId: string
    canonicalCategoryCode: string
    accountName: string
    externalAccountCode: string | null
  }): Promise<unknown> {
    return this.db.rpc('upsert_category_mapping', {
      p_organization_id: input.organizationId,
      p_canonical_category_code: input.canonicalCategoryCode,
      p_account_name: input.accountName,
      p_external_account_code: input.externalAccountCode
    })
  }

  async listActiveRules(organizationId: string): Promise<CategorizationRule[]> {
    return this.db.table<CategorizationRule[]>('classification_rules', {
      query: {
        organization_id: `eq.${organizationId}`,
        status: 'eq.active',
        select: '*',
        order: 'priority.desc,specificity.desc,created_at.desc'
      }
    })
  }

  async createRule(input: {
    organizationId: string
    name: string
    scope: StoredRuleScope
    predicate: RulePredicate
    canonicalCategoryCode: string
    organizationCategoryMappingId: string | null
    priority: number | null
  }): Promise<unknown> {
    return this.db.rpc('create_classification_rule', {
      p_organization_id: input.organizationId,
      p_name: input.name,
      p_scope: input.scope,
      p_predicate: input.predicate,
      p_canonical_category_code: input.canonicalCategoryCode,
      p_organization_category_mapping_id: input.organizationCategoryMappingId,
      p_priority: input.priority
    })
  }

  async disableRule(ruleId: string, reason: string): Promise<unknown> {
    return this.db.rpc('disable_classification_rule', { p_rule_id: ruleId, p_reason: reason })
  }

  async listCandidates(organizationId: string, limit: number): Promise<CategorizationCandidate[]> {
    return this.db.rpc<CategorizationCandidate[]>('get_categorization_candidates', {
      p_organization_id: organizationId,
      p_limit: limit
    })
  }

  async storeSuggestions(organizationId: string, suggestions: RuleSuggestion[]): Promise<unknown> {
    return this.db.rpc('store_rule_suggestions', {
      p_organization_id: organizationId,
      p_suggestions: suggestions
    })
  }

  async getQueue(organizationId: string, limit: number, status: string | null): Promise<unknown> {
    return this.db.rpc('get_categorization_queue', {
      p_organization_id: organizationId,
      p_limit: limit,
      p_status: status
    })
  }

  async getTransaction(organizationId: string, transactionId: string): Promise<CategorizationCandidate> {
    const rows = await this.db.table<TransactionRow[]>('normalized_transactions', {
      query: { id: `eq.${transactionId}`, organization_id: `eq.${organizationId}`, select: '*', limit: '1' }
    })
    const row = rows[0]
    if (!row) throw new LedgerlyError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404)
    return {
      id: row.id,
      organizationId: row.organization_id,
      financialAccountId: row.financial_account_id,
      postedDate: row.posted_date,
      descriptionOriginal: row.description_original,
      descriptionNormalized: row.description_normalized,
      amountMinor: row.amount_minor,
      currency: row.currency,
      direction: row.direction,
      externalReference: row.external_reference,
      counterpartyRaw: row.counterparty_raw
    }
  }

  async recordCorrection(input: {
    request: CorrectionRequest
    predicate: RulePredicate | null
  }): Promise<unknown> {
    return this.db.rpc('record_categorization_correction', {
      p_organization_id: input.request.organizationId,
      p_transaction_id: input.request.transactionId,
      p_canonical_category_code: input.request.canonicalCategoryCode,
      p_organization_category_mapping_id: input.request.organizationCategoryMappingId,
      p_scope: input.request.scope,
      p_predicate: input.predicate ?? {},
      p_reason: input.request.reason
    })
  }
}
