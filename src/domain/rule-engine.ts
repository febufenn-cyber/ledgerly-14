import type {
  CategorizationCandidate,
  CategorizationRule,
  ConfidenceBand,
  RulePredicate,
  RuleSuggestion
} from './categorization-types'

function normalized(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

export function buildRecurrenceKey(candidate: CategorizationCandidate): string {
  const identity = normalized(candidate.counterpartyRaw) || normalized(candidate.descriptionNormalized)
  return [identity, candidate.direction, candidate.currency.toUpperCase()].join('|')
}

export function ruleMatches(rule: CategorizationRule, candidate: CategorizationCandidate): boolean {
  if (rule.status !== 'active') return false
  if (rule.organization_id !== candidate.organizationId) return false
  const predicate = rule.predicate_json
  let checks = 0

  if (predicate.descriptionEquals !== undefined) {
    checks += 1
    if (normalized(predicate.descriptionEquals) !== normalized(candidate.descriptionNormalized)) return false
  }
  if (predicate.counterpartyEquals !== undefined) {
    checks += 1
    if (normalized(predicate.counterpartyEquals) !== normalized(candidate.counterpartyRaw)) return false
  }
  if (predicate.minAmountMinor !== undefined) {
    checks += 1
    if (candidate.amountMinor < predicate.minAmountMinor) return false
  }
  if (predicate.maxAmountMinor !== undefined) {
    checks += 1
    if (candidate.amountMinor > predicate.maxAmountMinor) return false
  }
  if (predicate.direction !== undefined) {
    checks += 1
    if (candidate.direction !== predicate.direction) return false
  }
  if (predicate.currency !== undefined) {
    checks += 1
    if (candidate.currency.toUpperCase() !== predicate.currency.toUpperCase()) return false
  }
  if (predicate.recurrenceKey !== undefined) {
    checks += 1
    if (buildRecurrenceKey(candidate) !== normalizedRecurrenceKey(predicate.recurrenceKey)) return false
  }

  return checks > 0
}

function normalizedRecurrenceKey(value: string): string {
  const [identity = '', direction = '', currency = ''] = value.split('|')
  return [normalized(identity), direction.toLowerCase(), currency.toUpperCase()].join('|')
}

function sourceWeight(rule: CategorizationRule): number {
  return rule.source_role === 'accountant' ? 2 : 1
}

function compareRules(left: CategorizationRule, right: CategorizationRule): number {
  return (
    sourceWeight(right) - sourceWeight(left) ||
    right.specificity - left.specificity ||
    right.priority - left.priority ||
    right.version - left.version ||
    right.created_at.localeCompare(left.created_at) ||
    left.id.localeCompare(right.id)
  )
}

function sameEffectiveRank(left: CategorizationRule, right: CategorizationRule): boolean {
  return (
    sourceWeight(left) === sourceWeight(right) &&
    left.specificity === right.specificity &&
    left.priority === right.priority &&
    left.version === right.version
  )
}

function confidenceFor(rule: CategorizationRule): ConfidenceBand {
  return rule.scope === 'exact_description' || rule.scope === 'recurring_series' ? 'high' : 'medium'
}

export function requiresAccountantReview(categoryCode: string): boolean {
  return (
    categoryCode.startsWith('asset.') ||
    categoryCode.startsWith('liability.') ||
    categoryCode.startsWith('equity.') ||
    categoryCode === 'expense.statutory_fees'
  )
}

function evidence(rule: CategorizationRule) {
  return {
    type: 'classification_rule' as const,
    ruleId: rule.id,
    ruleName: rule.name,
    scope: rule.scope,
    priority: rule.priority,
    specificity: rule.specificity,
    sourceRole: rule.source_role
  }
}

export function evaluateRules(
  candidate: CategorizationCandidate,
  rules: CategorizationRule[]
): RuleSuggestion {
  const matches = rules.filter((rule) => ruleMatches(rule, candidate)).sort(compareRules)
  const top = matches[0]

  if (!top) {
    return {
      transactionId: candidate.id,
      canonicalCategoryCode: null,
      sourceRuleId: null,
      confidenceBand: 'unknown',
      status: 'unresolved',
      evidence: [],
      alternatives: [],
      requiresFounderReview: true,
      requiresAccountantReview: false
    }
  }

  const equallyRanked = matches.filter((rule) => sameEffectiveRank(rule, top))
  const categories = [...new Set(equallyRanked.map((rule) => rule.canonical_category_code))]
  if (categories.length > 1) {
    return {
      transactionId: candidate.id,
      canonicalCategoryCode: null,
      sourceRuleId: null,
      confidenceBand: 'unknown',
      status: 'conflict',
      evidence: equallyRanked.map(evidence),
      alternatives: categories.sort(),
      requiresFounderReview: true,
      requiresAccountantReview: categories.some(requiresAccountantReview)
    }
  }

  return {
    transactionId: candidate.id,
    canonicalCategoryCode: top.canonical_category_code,
    sourceRuleId: top.id,
    confidenceBand: confidenceFor(top),
    status: 'suggested',
    evidence: equallyRanked
      .filter((rule) => rule.canonical_category_code === top.canonical_category_code)
      .map(evidence),
    alternatives: [],
    requiresFounderReview: true,
    requiresAccountantReview: requiresAccountantReview(top.canonical_category_code)
  }
}

export function countPredicateSpecificity(predicate: RulePredicate): number {
  return Object.values(predicate).filter((value) => value !== undefined).length
}
