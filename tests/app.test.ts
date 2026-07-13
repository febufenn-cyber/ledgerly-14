import { describe, expect, it } from 'vitest'
import { createApp } from '../src/api/app'

describe('worker app', () => {
  it('serves a public health endpoint without exposing financial data', async () => {
    const response = await createApp().request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: 'ledgerly', phase: 2 })
  })
})
