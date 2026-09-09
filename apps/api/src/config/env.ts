import { z } from 'zod';
import { baseEnvSchema, validateEnv } from '@real-estate/config';

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Used to build absolute signed-media-access URLs — see StorageService. */
  API_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_TTL: z.string().default('30d'),

  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(1440),
  PHONE_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  PHONE_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  /**
   * 'console' (default) logs to the server console in development and
   * does nothing in production — see ConsoleMailProvider. 'smtp' sends
   * real email via any SMTP server/relay (Gmail app password, SES SMTP
   * endpoint, SendGrid/Mailgun/Postmark SMTP relay, a company mail
   * server, etc.) using the SMTP_* variables below — see SmtpMailProvider
   * and MailModule. SMTP_* are validated for presence at module-bootstrap
   * time (not in this schema) so they stay optional for everyone still
   * using the 'console' default.
   */
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** true for implicit TLS (port 465); false (default) uses STARTTLS on 587. */
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** The From: address on outgoing mail — falls back to SMTP_USER when unset. */
  SMTP_FROM: z.string().optional(),

  /**
   * 'console' (default) logs to the server console in development and
   * does nothing in production — see ConsoleSmsProvider. 'twilio-whatsapp'
   * delivers the verification code as a WhatsApp message via Twilio's
   * WhatsApp Business API using the TWILIO_* variables below — see
   * TwilioWhatsAppProvider and SmsModule. Same optional-until-selected
   * validation approach as SMTP_* above.
   */
  SMS_PROVIDER: z.enum(['console', 'twilio-whatsapp']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  /** Twilio's approved WhatsApp sender, e.g. "whatsapp:+14155238886" (their sandbox number) or a real approved Business number. */
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  /// Only 'local' exists today (a real filesystem, private by default —
  /// see StorageModule). Swapping to an S3-compatible provider later is
  /// meant to be a new value here plus a new StorageService
  /// implementation, with no change to any caller.
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.data/property-media'),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  STORAGE_SIGNING_SECRET: z.string().min(16),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(
  env: Record<string, string | undefined>,
): ApiEnv {
  return validateEnv(apiEnvSchema, env);
}
