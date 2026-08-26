import { z } from 'zod';
import { baseEnvSchema, validateEnv } from '@real-estate/config';

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
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

  EMAIL_PROVIDER: z.enum(['console']).default('console'),
  SMS_PROVIDER: z.enum(['console']).default('console'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(
  env: Record<string, string | undefined>,
): ApiEnv {
  return validateEnv(apiEnvSchema, env);
}
