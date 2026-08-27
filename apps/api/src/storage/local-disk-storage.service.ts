import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import type { StorageService } from './storage.service';

/**
 * Local-filesystem implementation of `StorageService` — the environment
 * this project runs in has no S3-compatible credentials configured (see
 * `.env` "Property media storage"), so this is the real storage backend
 * for now, not a placeholder. Files live under `STORAGE_LOCAL_DIR`
 * (default `.data/property-media`, gitignored), which is never served
 * directly — only through `StorageAccessController`, which requires a
 * valid signed token.
 */
@Injectable()
export class LocalDiskStorageService implements StorageService {
  private readonly rootDir: string;
  private readonly signingSecret: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly apiUrl: string;

  constructor(configService: ConfigService<ApiEnv, true>) {
    this.rootDir = resolve(
      configService.get('STORAGE_LOCAL_DIR', { infer: true }),
    );
    this.signingSecret = configService.get('STORAGE_SIGNING_SECRET', {
      infer: true,
    });
    this.signedUrlTtlSeconds = configService.get(
      'STORAGE_SIGNED_URL_TTL_SECONDS',
      {
        infer: true,
      },
    );
    this.apiUrl = configService.get('API_URL', { infer: true });
  }

  /** Rejects anything that could escape `rootDir` — keys are server-generated, this is defense in depth. */
  private resolvePath(key: string): string {
    if (key.includes('..') || key.startsWith('/') || key.includes('\0')) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return join(this.rootDir, key);
  }

  /** `contentType` isn't needed by this provider (the mime type is stored on the `PropertyMedia` row instead) — a real S3 provider would pass it through as an object header. */
  async putObject(key: string, buffer: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async readObject(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  private sign(key: string, expiresAt: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${key}:${expiresAt}`)
      .digest('hex');
  }

  getSignedAccessUrl(key: string): Promise<string> {
    const expiresAt = Date.now() + this.signedUrlTtlSeconds * 1000;
    const signature = this.sign(key, expiresAt);
    const query = new URLSearchParams({
      key,
      exp: String(expiresAt),
      sig: signature,
    });
    return Promise.resolve(
      `${this.apiUrl}/api/v1/storage/access?${query.toString()}`,
    );
  }

  /** Used by StorageAccessController — verifies a signature produced by getSignedAccessUrl. */
  verifySignature(key: string, expiresAt: number, signature: string): boolean {
    if (Date.now() > expiresAt) {
      return false;
    }
    const expected = this.sign(key, expiresAt);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}

/** Deterministic, collision-resistant object key for a piece of property media. */
export function buildPropertyMediaStorageKey(
  propertyId: string,
  mediaId: string,
  originalFileName: string,
): string {
  const safeSuffix = createHash('sha1')
    .update(originalFileName)
    .digest('hex')
    .slice(0, 8);
  return `properties/${propertyId}/${mediaId}-${safeSuffix}`;
}
