import type { SourceObjectStore } from '../domain/import-service'

export class R2SourceObjectStore implements SourceObjectStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: { sha256: metadata.sha256 }
    })
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key)
    if (!object) return null
    return new Uint8Array(await object.arrayBuffer())
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }
}
