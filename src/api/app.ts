import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { RulePredicate, StoredRuleScope } from '../domain/categorization-types'
import { CategorizationService } from '../domain/categorization-service'
import { asLedgerlyError, LedgerlyError } from '../domain/errors'
import { ImportService } from '../domain/import-service'
import type { CsvMapping } from '../domain/types'
import type { Bindings } from '../env'
import { maxUploadBytes } from '../env'
import { authenticate } from '../infra/auth'
import { CategorizationRepository } from '../infra/categorization-repository'
import { LedgerlyRepository } from '../infra/repository'
import { R2SourceObjectStore } from '../infra/r2-store'
import { SupabaseRestClient } from '../infra/supabase'

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(100).default('Asia/Kolkata')
})

const accountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institutionName: z.string().trim().max(120).nullable().default(null),
  accountType: z.enum(['bank_current', 'bank_savings', 'credit_card', 'payment_processor', 'cash', 'other']),
  currency: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  maskedIdentifier: z.string().trim().max(32).nullable().default(null)
})

const importSchema = z.object({
  financialAccountId: z.string().uuid(),
  sourceType: z.enum(['bank_csv', 'stripe_csv', 'razorpay_csv', 'manual']).default('bank_csv'),
  originalFilename: z.string().trim().min(1).max(255)
})

const mappingSchema = z.object({
  headerRowIndex: z.number().int().min(0),
  delimiter: z.enum([',', ';', '\t', '|']),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  columns: z.object({
    postedDate: z.number().int().min(0),
    transactionDate: z.number().int().min(0).optional(),
    description: z.number().int().min(0),
    reference: z.number().int().min(0).optional(),
    debit: z.number().int().min(0).optional(),
    credit: z.number().int().min(0).optional(),
    signedAmount: z.number().int().min(0).optional(),
    direction: z.number().int().min(0).optional(),
    balance: z.number().int().min(0).optional(),
    counterparty: z.number().int().min(0).optional()
  }),
  directionStrategy: z.enum(['separate_debit_credit', 'signed_amount', 'amount_and_type']),
  debitLabels: z.array(z.string()).optional(),
  creditLabels: z.array(z.string()).optional()
})

const commitSchema = z.object({ attemptId: z.string().uuid() })

const categoryMappingSchema = z.object({
  canonicalCategoryCode: z.string().trim().min(3).max(120),
  accountName: z.string().trim().min(1).max(160),
  externalAccountCode: z.string().trim().max(80).nullable().default(null)
})

const predicateSchema = z.object({
  descriptionEquals: z.string().trim().min(1).max(500).optional(),
  counterpartyEquals: z.string().trim().min(1).max(300).optional(),
  minAmountMinor: z.number().int().min(0).optional(),
  maxAmountMinor: z.number().int().min(0).optional(),
  direction: z.enum(['debit', 'credit']).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  recurrenceKey: z.string().trim().min(1).max(700).optional()
}).strict()

const storedScopeSchema = z.enum([
  'exact_description',
  'merchant_amount_range',
  'recurring_series',
  'merchant_entity_future',
  'historical_and_future_matches'
])

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  scope: storedScopeSchema,
  predicate: predicateSchema,
  canonicalCategoryCode: z.string().trim().min(3).max(120),
  organizationCategoryMappingId: z.string().uuid().nullable().default(null),
  priority: z.number().int().min(0).max(2000).nullable().default(null)
})

const disableRuleSchema = z.object({ reason: z.string().trim().min(1).max(500) })

const correctionSchema = z.object({
  organizationId: z.string().uuid(),
  canonicalCategoryCode: z.string().trim().min(3).max(120),
  organizationCategoryMappingId: z.string().uuid().nullable().default(null),
  scope: z.enum([
    'transaction_only',
    'exact_description',
    'merchant_amount_range',
    'recurring_series',
    'merchant_entity_future',
    'historical_and_future_matches'
  ]),
  reason: z.string().trim().min(1).max(500),
  amountToleranceMinor: z.number().int().min(0).optional()
})

const runQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) })
const queueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  status: z.enum(['unclassified','suggested','conflict','unresolved','approved','corrected']).nullable().default(null)
})

type AppEnv = { Bindings: Bindings }

function jsonBody<T>(result: { success: true; data: T } | { success: false; error: z.ZodError }): T {
  if (!result.success) {
    throw new LedgerlyError('VALIDATION_FAILED', 'Request body is invalid', 422, {
      issues: result.error.issues
    })
  }
  return result.data
}

async function requestServices(c: Context<AppEnv>) {
  const user = await authenticate(c.env, c.req.header('authorization'))
  const db = new SupabaseRestClient({
    url: c.env.SUPABASE_URL,
    anonKey: c.env.SUPABASE_ANON_KEY,
    accessToken: user.accessToken
  })
  const repository = new LedgerlyRepository(db)
  const categorizationRepository = new CategorizationRepository(db)
  const imports = new ImportService(repository, new R2SourceObjectStore(c.env.SOURCES), maxUploadBytes(c.env))
  const categorization = new CategorizationService(categorizationRepository)
  return { user, repository, imports, categorizationRepository, categorization }
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  app.get('/health', (c) => c.json({ ok: true, service: 'ledgerly', phase: 2 }))

  app.post('/v1/organizations', async (c) => {
    const { user, repository } = await requestServices(c)
    const body = jsonBody(organizationSchema.safeParse(await c.req.json()))
    const organization = await repository.createOrganization({ ...body, userId: user.id })
    return c.json({ data: organization }, 201)
  })

  app.post('/v1/organizations/:organizationId/accounts', async (c) => {
    const { user, repository } = await requestServices(c)
    const body = jsonBody(accountSchema.safeParse(await c.req.json()))
    const account = await repository.createFinancialAccount({
      organizationId: c.req.param('organizationId'),
      name: body.name,
      institutionName: body.institutionName,
      accountType: body.accountType,
      currency: body.currency,
      maskedIdentifier: body.maskedIdentifier,
      userId: user.id
    })
    return c.json({ data: account }, 201)
  })

  app.post('/v1/organizations/:organizationId/imports', async (c) => {
    const { user, repository } = await requestServices(c)
    const body = jsonBody(importSchema.safeParse(await c.req.json()))
    const record = await repository.createImport({
      organizationId: c.req.param('organizationId'),
      financialAccountId: body.financialAccountId,
      sourceType: body.sourceType,
      originalFilename: body.originalFilename,
      userId: user.id
    })
    return c.json({ data: record }, 201)
  })

  app.put('/v1/imports/:importId/source', async (c) => {
    const { user, repository, imports } = await requestServices(c)
    const record = await repository.getImport(c.req.param('importId'))
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    const file = await imports.uploadSource({
      importRecord: record,
      bytes,
      contentTypeClaimed: c.req.header('content-type') ?? null,
      userId: user.id
    })
    return c.json({ data: file }, 201)
  })

  app.post('/v1/imports/:importId/detect', async (c) => {
    const { imports } = await requestServices(c)
    const preview = await imports.detect(c.req.param('importId'))
    return c.json({ data: preview })
  })

  app.post('/v1/imports/:importId/attempts', async (c) => {
    const { repository, imports } = await requestServices(c)
    const record = await repository.getImport(c.req.param('importId'))
    const mapping = jsonBody(mappingSchema.safeParse(await c.req.json())) as CsvMapping
    const staged = await imports.stage({ importRecord: record, mapping })
    return c.json({ data: staged }, 201)
  })

  app.get('/v1/imports/:importId/preview', async (c) => {
    const { repository } = await requestServices(c)
    const preview = await repository.getAttemptPreview(c.req.param('importId'))
    return c.json({ data: preview })
  })

  app.post('/v1/imports/:importId/commit', async (c) => {
    const { repository } = await requestServices(c)
    const body = jsonBody(commitSchema.safeParse(await c.req.json()))
    const result = await repository.commitAttempt(c.req.param('importId'), body.attemptId)
    return c.json({ data: result })
  })

  app.get('/v1/organizations/:organizationId/categories', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const [categories, mappings] = await Promise.all([
      categorizationRepository.listCategories(),
      categorizationRepository.listMappings(c.req.param('organizationId'))
    ])
    return c.json({ data: { categories, mappings } })
  })

  app.put('/v1/organizations/:organizationId/category-mappings', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const body = jsonBody(categoryMappingSchema.safeParse(await c.req.json()))
    const result = await categorizationRepository.upsertMapping({
      organizationId: c.req.param('organizationId'),
      canonicalCategoryCode: body.canonicalCategoryCode,
      accountName: body.accountName,
      externalAccountCode: body.externalAccountCode
    })
    return c.json({ data: result })
  })

  app.get('/v1/organizations/:organizationId/rules', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const rules = await categorizationRepository.listActiveRules(c.req.param('organizationId'))
    return c.json({ data: rules })
  })

  app.post('/v1/organizations/:organizationId/rules', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const body = jsonBody(ruleSchema.safeParse(await c.req.json()))
    const result = await categorizationRepository.createRule({
      organizationId: c.req.param('organizationId'),
      name: body.name,
      scope: body.scope as StoredRuleScope,
      predicate: body.predicate as RulePredicate,
      canonicalCategoryCode: body.canonicalCategoryCode,
      organizationCategoryMappingId: body.organizationCategoryMappingId,
      priority: body.priority
    })
    return c.json({ data: result }, 201)
  })

  app.post('/v1/rules/:ruleId/disable', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const body = jsonBody(disableRuleSchema.safeParse(await c.req.json()))
    const result = await categorizationRepository.disableRule(c.req.param('ruleId'), body.reason)
    return c.json({ data: result })
  })

  app.post('/v1/organizations/:organizationId/categorization/run', async (c) => {
    const { categorization } = await requestServices(c)
    const query = jsonBody(runQuerySchema.safeParse({ limit: c.req.query('limit') }))
    const result = await categorization.runRules(c.req.param('organizationId'), query.limit)
    return c.json({ data: result })
  })

  app.get('/v1/organizations/:organizationId/categorization/queue', async (c) => {
    const { categorizationRepository } = await requestServices(c)
    const query = jsonBody(queueQuerySchema.safeParse({
      limit: c.req.query('limit'),
      status: c.req.query('status') ?? null
    }))
    const result = await categorizationRepository.getQueue(
      c.req.param('organizationId'), query.limit, query.status
    )
    return c.json({ data: result })
  })

  app.post('/v1/transactions/:transactionId/classification', async (c) => {
    const { categorization } = await requestServices(c)
    const body = jsonBody(correctionSchema.safeParse(await c.req.json()))
    const result = await categorization.correct({
      organizationId: body.organizationId,
      transactionId: c.req.param('transactionId'),
      canonicalCategoryCode: body.canonicalCategoryCode,
      organizationCategoryMappingId: body.organizationCategoryMappingId,
      scope: body.scope,
      reason: body.reason,
      ...(body.amountToleranceMinor === undefined ? {} : { amountToleranceMinor: body.amountToleranceMinor })
    })
    return c.json({ data: result })
  })

  app.onError((error, c) => {
    const normalized = asLedgerlyError(error)
    return c.json(
      {
        error: {
          code: normalized.code,
          message: normalized.message,
          ...(normalized.details ? { details: normalized.details } : {})
        }
      },
      normalized.status as 400
    )
  })

  return app
}
