# Phase 1 API

All `/v1` routes require a Supabase bearer access token. The worker validates it through Supabase Auth, then sends the same user JWT to PostgREST so RLS remains active.

## Organizations and accounts

- `POST /v1/organizations`
- `POST /v1/organizations/:organizationId/accounts`

## Import lifecycle

- `POST /v1/organizations/:organizationId/imports`
- `PUT /v1/imports/:importId/source`
- `POST /v1/imports/:importId/detect`
- `POST /v1/imports/:importId/attempts`
- `GET /v1/imports/:importId/preview`
- `POST /v1/imports/:importId/commit`

## Source upload

The source endpoint accepts raw CSV bytes. It enforces the configured size limit, rejects empty/binary content, calculates SHA-256, checks exact duplication within the account, and writes to a private content-addressed organization/import R2 path. An import cannot silently overwrite its source after it advances beyond the upload state.

## Mapping request

A mapping declares:

- header row index;
- delimiter;
- date format;
- currency;
- column positions;
- amount/direction strategy;
- optional debit and credit labels.

Ambiguous dates are not silently resolved by detection.

## Error contract

```json
{
  "error": {
    "code": "ROW_INVALID_AMOUNT",
    "message": "Amount could not be parsed deterministically",
    "details": {}
  }
}
```

Stable codes cover authentication, files, mapping, rows, attempts, commit conflicts, and upstream failures.
