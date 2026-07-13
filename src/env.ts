export interface Bindings {
  SOURCES: R2Bucket
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SOURCE_BUCKET_NAME: string
  MAX_UPLOAD_BYTES: string
}

export function maxUploadBytes(env: Bindings): number {
  const parsed = Number(env.MAX_UPLOAD_BYTES || '10485760')
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024
}
