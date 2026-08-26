import { Prisma } from '@prisma/client';

/** True when `error` is a Prisma unique-constraint violation (P2002), optionally scoped to one field. */
export function isUniqueConstraintViolation(
  error: unknown,
  field?: string,
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  if (!field) {
    return true;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes(field);
  }
  if (typeof target === 'string') {
    return target.includes(field);
  }
  return false;
}
