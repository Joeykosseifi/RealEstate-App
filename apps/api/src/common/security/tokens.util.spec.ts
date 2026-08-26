import {
  generateNumericOtp,
  generateSecureToken,
  secureCompareHex,
  sha256Hex,
} from './tokens.util';

describe('tokens.util', () => {
  it('generateSecureToken produces high-entropy, unique, URL-safe tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generateNumericOtp produces a 6-digit zero-padded code by default', () => {
    for (let i = 0; i < 20; i += 1) {
      const otp = generateNumericOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it('generateNumericOtp respects a custom digit count', () => {
    expect(generateNumericOtp(4)).toMatch(/^\d{4}$/);
  });

  it('sha256Hex is deterministic and matches the known digest of an empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });

  it('secureCompareHex matches equal hex strings and rejects different ones', () => {
    const hash = sha256Hex('some-secret');
    expect(secureCompareHex(hash, sha256Hex('some-secret'))).toBe(true);
    expect(secureCompareHex(hash, sha256Hex('other-secret'))).toBe(false);
  });

  it('secureCompareHex safely rejects mismatched lengths instead of throwing', () => {
    expect(secureCompareHex('ab', 'abcd')).toBe(false);
  });
});
