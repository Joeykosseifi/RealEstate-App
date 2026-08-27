export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

/**
 * Object-storage abstraction for private property media (see
 * docs/DATABASE.md "Property media storage"). `LocalDiskStorageService`
 * is the only implementation today; a real S3-compatible provider is a
 * drop-in replacement behind this same interface — no caller changes.
 *
 * Callers never construct or trust a client-supplied storage key for
 * reads/deletes — the key is always resolved from the owning
 * `PropertyMedia` row first (see PropertyMediaService).
 */
export interface StorageService {
  /** Stores the object under `key`, overwriting any existing object at that key. */
  putObject(key: string, buffer: Buffer, contentType: string): Promise<void>;

  /** A short-lived URL that grants read access to `key` without exposing a permanent public URL. */
  getSignedAccessUrl(key: string): Promise<string>;

  /**
   * Reads the object's raw bytes server-side — used by
   * PdfGeneratorService to embed property images directly into a
   * generated PDF (any real object-storage provider supports an
   * equivalent GetObject call; this is not local-disk-specific).
   */
  readObject(key: string): Promise<Buffer>;

  /** Idempotent — deleting an already-missing key is not an error. */
  deleteObject(key: string): Promise<void>;
}
