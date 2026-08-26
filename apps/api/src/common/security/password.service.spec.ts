import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and never returns the plaintext', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct-horse-battery-staple');
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(
      service.verify(hash, 'correct-horse-battery-staple'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('fails closed (returns false, never throws) for a malformed hash', async () => {
    await expect(service.verify('not-a-real-hash', 'anything')).resolves.toBe(
      false,
    );
  });

  it('produces a different hash each time (random salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password'),
      service.hash('same-password'),
    ]);
    expect(a).not.toBe(b);
  });
});
