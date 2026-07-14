import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { AiSuggestionService } from '../domain/ai-service'
import { asLedgerlyError, LedgerlyError } from '../domain/errors'
import type { Bindings } from '../env'
import { AiRepository } from '../infra/ai-repository'
import { authenticate } from '../infra/auth'
import { FakeAiModelAdapter } from '../infra/fake-ai-adapter'
import { SupabaseRestClient } from '../infra/supabase'

type AiAppEnv = { Bindings: Bindings }

const policySchema = z.object({
  enabled: z.boolean(),
  provider: z.literal('fake').default('fake'),
  model: z.literal('fixture-v1').default('fixture-v1'),
  promptVersion: z.string().trim().min(1).max(100).default('phase-3-prompt-v1'),
  policyVersion: z.string().trim().min(1).max(100).default('phase-3-policy-v1'),
  schemaVersion: z.string().trim().min(1).max(100).default('phase-3-schema-v1'),
  monthlyBudgetMinor: z.number().int().min(0).default(0),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
  retryLimit: z.number().int().min(0).max(2).default(0)
}).strict()

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
})

function jsonBody<T>(result: { success: true; data: T } | { success: false; error: z.ZodError }): T {
  if (!result.success) {
    throw new LedgerlyError('VALIDATION_FAILED', 'Request body is invalid', 422, {
      issues: result.error.issues
    })
  }
  return result.data
}

async function services(c: Context<AiAppEnv>) {
  const user = await authenticate(c.env, c.req.header('authorization'))
  const db = new SupabaseRestClient({
    url: c.env.SUPABASE_URL,
    anonKey: c.env.SUPABASE_ANON_KEY,
    accessToken: user.accessToken
  })
  const repository = new AiRepository(db)
  const suggestions = new AiSuggestionService(repository, new FakeAiModelAdapter())
  return { repository, suggestions }
}

export function createAiApp(): Hono<AiAppEnv> {
  const app = new Hono<AiAppEnv>()

  app.put('/v1/organizations/:organizationId/ai/policy', async (c) => {
    const { repository } = await services(c)
    const body = jsonBody(policySchema.safeParse(await c.req.json()))
    const result = await repository.configurePolicy({
      organizationId: c.req.param('organizationId'),
      ...body
    })
    return c.json({ data: result })
  })

  app.get('/v1/organizations/:organizationId/ai/policy', async (c) => {
    const { repository } = await services(c)
    const result = await repository.getPolicy(c.req.param('organizationId'))
    return c.json({ data: result })
  })

  app.post('/v1/organizations/:organizationId/transactions/:transactionId/ai-suggestion', async (c) => {
    const { suggestions } = await services(c)
    const result = await suggestions.run(
      c.req.param('organizationId'),
      c.req.param('transactionId')
    )
    return c.json({ data: result }, 201)
  })

  app.get('/v1/organizations/:organizationId/ai/suggestions', async (c) => {
    const { repository } = await services(c)
    const query = jsonBody(listSchema.safeParse({ limit: c.req.query('limit') }))
    const result = await repository.listSuggestions(c.req.param('organizationId'), query.limit)
    return c.json({ data: result })
  })

  app.get('/v1/ai/runs/:runId', async (c) => {
    const { repository } = await services(c)
    const result = await repository.getRunDiagnostic(c.req.param('runId'))
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
