# Phase 1 deployment

## Prerequisites

- Supabase project with Auth enabled.
- Private Cloudflare R2 bucket.
- Cloudflare Workers account.

## Database

Apply `supabase/migrations/202607130001_phase1_ingestion.sql` to a non-production project first. Review all policies and execute cross-tenant tests before production.

## Worker configuration

Set encrypted secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

Configure `SOURCES`, `SOURCE_BUCKET_NAME`, and `MAX_UPLOAD_BYTES` through Wrangler. Never put a Supabase service-role key in the browser or repository.

## Verification

1. Run `npm install --ignore-scripts && npm run check`.
2. Create two Supabase users and two organizations.
3. Verify each user receives 404/403-equivalent behavior for the other tenant.
4. Upload a synthetic CSV and inspect the R2 object metadata.
5. Stage, preview, and commit an import.
6. Retry the commit and verify no additional active rows appear.
7. Re-upload the same file and verify `IMPORT_DUPLICATE_FILE`.
