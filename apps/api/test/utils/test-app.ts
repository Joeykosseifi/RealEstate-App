import { randomInt } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { MailService, type MailMessage } from '../../src/mail/mail.service';
import { SmsService } from '../../src/sms/sms.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

export class CapturingMailService implements MailService {
  sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  latestFor(to: string): MailMessage {
    const match = [...this.sent].reverse().find((m) => m.to === to);
    if (!match) {
      throw new Error(`No email captured for ${to}`);
    }
    return match;
  }
}

export class CapturingSmsService implements SmsService {
  sent: { to: string; body: string }[] = [];

  send(toPhone: string, body: string): Promise<void> {
    this.sent.push({ to: toPhone, body });
    return Promise.resolve();
  }

  latestFor(to: string): { to: string; body: string } {
    const match = [...this.sent].reverse().find((m) => m.to === to);
    if (!match) {
      throw new Error(`No SMS captured for ${to}`);
    }
    return match;
  }
}

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  redis: RedisService;
  mail: CapturingMailService;
  sms: CapturingSmsService;
}

/**
 * Every request from supertest originates from the same local
 * connection, so IP-scoped rate-limit counters accumulate across
 * unrelated tests in the same file. Call this between tests that don't
 * intend to exercise rate limiting themselves — it only clears counters
 * in the test Redis instance, it does not change any limit's threshold.
 */
export async function resetRateLimits(testApp: TestApp): Promise<void> {
  await testApp.redis.getClient().flushdb();
}

/** Boots a real Nest application (real Postgres + Redis) with the same bootstrap config as main.ts. */
export async function createTestApp(): Promise<TestApp> {
  const mail = new CapturingMailService();
  const sms = new CapturingSmsService();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(SmsService)
    .useValue(sms)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  const redis = moduleRef.get(RedisService);
  await redis.getClient().flushdb();

  return { app, prisma, redis, mail, sms };
}

export function extractEmailToken(message: MailMessage): string {
  const match = /token is: (\S+)/.exec(message.text);
  if (!match) {
    throw new Error(`No token found in email text: ${message.text}`);
  }
  return match[1];
}

export function extractOtp(entry: { body: string }): string {
  const match = /code is (\d{6})/.exec(entry.body);
  if (!match) {
    throw new Error(`No OTP found in SMS body: ${entry.body}`);
  }
  return match[1];
}

export function extractResetToken(message: MailMessage): string {
  const match = /token is: (\S+)/.exec(message.text);
  if (!match) {
    throw new Error(`No reset token found in email text: ${message.text}`);
  }
  return match[1];
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${Date.now()}.${randomInt(1_000_000)}@example.test`;
}

/**
 * Valid, unique E.164 US numbers for tests. Random 7-digit local numbers
 * (starting 2-9, per NANP exchange-code rules) in area code 415 are
 * accepted by libphonenumber-js's isValid() check, and the space is large
 * enough (~8,000,000 combinations) that collisions across a full test run
 * are not a practical concern.
 */
export function uniquePhone(): string {
  const local = randomInt(2_000_000, 9_999_999);
  return `+1415${local}`;
}
