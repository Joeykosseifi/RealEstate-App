import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing. Parameters follow OWASP's current baseline
 * recommendation for Argon2id (m=19MiB, t=2, p=1) — deliberately not
 * configurable via env, so a misconfigured deployment can't silently
 * weaken hashing.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, this.options);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
