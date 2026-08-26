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
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateApiEnv(
  env: Record<string, string | undefined>,
): ApiEnv {
  return validateEnv(apiEnvSchema, env);
}
