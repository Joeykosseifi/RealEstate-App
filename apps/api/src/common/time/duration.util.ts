const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses a short duration string ("15m", "30d", "45s", "2h") into milliseconds. */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration string: "${input}". Expected e.g. "15m", "2h", "30d".`,
    );
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
