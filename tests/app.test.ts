import { describe, expect, it } from 'vitest'
import app from '../src/index'

describe('worker app', () => {
  it('serves a public Phase 3 health endpoint without exposing financial data', async () => {
    const response = await app.request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: 'ledgerly', phase: 3 })
  })

  it('requires authentication for AI policy and suggestion routes', async () => {
    const response = await app.request('/v1/organizations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ai/policy')
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_MISSING' } })
  })
})
