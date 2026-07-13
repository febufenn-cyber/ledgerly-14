import { LedgerlyError } from '../domain/errors'

interface SupabaseConfig {
  url: string
  anonKey: string
  accessToken: string
  fetcher?: typeof fetch
}

export interface RestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string>
  body?: unknown
  prefer?: string
  single?: boolean
}

export class SupabaseRestClient {
  private readonly baseUrl: string
  private readonly anonKey: string
  private readonly accessToken: string
  private readonly fetcher: typeof fetch

  constructor(config: SupabaseConfig) {
    this.baseUrl = config.url.replace(/\/$/, '')
    this.anonKey = config.anonKey
    this.accessToken = config.accessToken
    this.fetcher = config.fetcher ?? fetch
  }

  async table<T>(table: string, options: RestOptions = {}): Promise<T> {
    return this.request<T>(`/rest/v1/${encodeURIComponent(table)}`, options)
  }

  async rpc<T>(name: string, body: unknown): Promise<T> {
    return this.request<T>(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: 'POST',
      body,
      single: true
    })
  }

  private async request<T>(path: string, options: RestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value)

    const headers = new Headers({
      apikey: this.anonKey,
      authorization: `Bearer ${this.accessToken}`,
      accept: 'application/json'
    })
    if (options.body !== undefined) headers.set('content-type', 'application/json')
    if (options.prefer) headers.set('prefer', options.prefer)
    if (options.single) headers.set('accept', 'application/vnd.pgrst.object+json')

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    const response = await this.fetcher(url.toString(), init)

    if (!response.ok) {
      const text = await response.text()
      const status = response.status === 404 ? 404 : response.status === 401 ? 401 : response.status === 403 ? 403 : 502
      throw new LedgerlyError(
        response.status === 404 ? 'NOT_FOUND' : response.status === 403 ? 'FORBIDDEN' : 'UPSTREAM_ERROR',
        'Database operation failed',
        status,
        { upstreamStatus: response.status, upstreamBody: text.slice(0, 500) }
      )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}
