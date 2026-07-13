const encoder = new TextEncoder()

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Bytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data)
  const view = new Uint8Array(source.byteLength)
  view.set(source)
  const digest = await crypto.subtle.digest('SHA-256', view.buffer)
  return bytesToHex(new Uint8Array(digest))
}

export async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(encoder.encode(value))
}

export async function rawRowFingerprint(
  fileSha256: string,
  physicalRowNumber: number,
  fields: readonly string[]
): Promise<string> {
  return sha256Text(JSON.stringify([fileSha256, physicalRowNumber, fields]))
}

export async function strongMovementIdentity(input: {
  organizationId: string
  financialAccountId: string
  externalReference: string | null
  postedDate: string | null
  amountMinor: number | null
  direction: string | null
}): Promise<string | null> {
  if (!input.externalReference || !input.postedDate || input.amountMinor === null || !input.direction) {
    return null
  }
  return sha256Text(
    JSON.stringify([
      input.organizationId,
      input.financialAccountId,
      input.externalReference.trim(),
      input.postedDate,
      input.amountMinor,
      input.direction
    ])
  )
}

export async function candidateSimilarityKey(input: {
  organizationId: string
  financialAccountId: string
  postedDate: string | null
  amountMinor: number | null
  direction: string | null
  descriptionNormalized: string
}): Promise<string | null> {
  if (!input.postedDate || input.amountMinor === null || !input.direction) return null
  return sha256Text(
    JSON.stringify([
      input.organizationId,
      input.financialAccountId,
      input.postedDate,
      input.amountMinor,
      input.direction,
      input.descriptionNormalized
    ])
  )
}
