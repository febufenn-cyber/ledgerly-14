import { LedgerlyError } from '../domain/errors'
import type { AuthenticatedUser } from '../domain/types'
import type { Bindings } from '../env'

interface SupabaseUserResponse {
  id?: unknown
  email?: unknown
}

export function bearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new LedgerlyError('AUTH_MISSING', 'A bearer access token is required', 401)
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) throw new LedgerlyError('AUTH_MISSING', 'A bearer access token is required', 401)
  return token
}

export async function authenticate(
  env: Pick<Bindings, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>,
  authorizationHeader: string | undefined,
  fetcher: typeof fetch = fetch
): Promise<AuthenticatedUser> {
  const accessToken = bearerToken(authorizationHeader)
  const response = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`
    }
  })
  if (!response.ok) throw new LedgerlyError('AUTH_INVALID', 'The access token is invalid or expired', 401)
  const body = (await response.json()) as SupabaseUserResponse
  if (typeof body.id !== 'string') throw new LedgerlyError('AUTH_INVALID', 'Authentication response is invalid', 401)
  return {
    id: body.id,
    email: typeof body.email === 'string' ? body.email : null,
    accessToken
  }
}
