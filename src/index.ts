import { Hono } from 'hono'
import { createAiApp } from './api/ai-app'
import { createApp } from './api/app'
import type { Bindings } from './env'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/health', (c) => c.json({ ok: true, service: 'ledgerly', phase: 3 }))
app.route('/', createAiApp())
app.route('/', createApp())

export default app
