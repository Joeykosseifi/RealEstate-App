import { z } from 'zod';

/**
 * Shared environment schema for backend services. Individual apps may
 * extend this with their own additional required variables, but should
 * not redefine the fields below — keeping one source of truth prevents
 * config drift between apps/api and any future backend service.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  REDIS_URL: z.string().url().startsWith('redis://'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validates `process.env`-like input against a schema, throwing a single
 * readable error listing every problem at once rather than failing on the
 * first missing variable. Intended to be called once at process startup.
 */
export function validateEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  env: Record<string, string | undefined>,
): z.infer<TSchema> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
