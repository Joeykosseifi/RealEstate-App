import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it('parses seconds, minutes, hours, and days', () => {
    expect(parseDurationMs('45s')).toBe(45_000);
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationMs('30d')).toBe(30 * 86_400_000);
  });

  it('throws on an invalid duration string', () => {
    expect(() => parseDurationMs('banana')).toThrow();
    expect(() => parseDurationMs('15')).toThrow();
    expect(() => parseDurationMs('15x')).toThrow();
  });
});
