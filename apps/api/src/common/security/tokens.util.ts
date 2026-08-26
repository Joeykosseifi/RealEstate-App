import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** A high-entropy, URL-safe random token (256 bits) for links (email verify, password reset). */
export function generateSecureToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A cryptographically random n-digit numeric code, for OTP/SMS delivery. */
export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  const value = randomInt(0, max);
  return value.toString().padStart(digits, '0');
}

/** SHA-256 hex digest — used to store a verifiable representation of a secret without persisting it. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time equality check for hex digests, to avoid timing side channels. */
export function secureCompareHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
