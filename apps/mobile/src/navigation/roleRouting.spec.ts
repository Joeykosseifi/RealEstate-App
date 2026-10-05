import { resolveMainTabsKind } from './roleRouting';

describe('resolveMainTabsKind', () => {
  it('routes CLIENT accounts to the client tabs', () => {
    expect(resolveMainTabsKind('CLIENT', true)).toBe('client');
  });

  it('routes AGENT accounts to the professional tabs', () => {
    expect(resolveMainTabsKind('AGENT', true)).toBe('professional');
  });

  it('routes COMPANY accounts to the professional tabs', () => {
    expect(resolveMainTabsKind('COMPANY', true)).toBe('professional');
  });

  it('never routes a client to the professional tabs and vice versa', () => {
    expect(resolveMainTabsKind('CLIENT', true)).not.toBe(resolveMainTabsKind('AGENT', true));
    expect(resolveMainTabsKind('CLIENT', true)).not.toBe(resolveMainTabsKind('COMPANY', true));
  });

  it('defaults to professional when accountType is unknown (never silently becomes a client)', () => {
    expect(resolveMainTabsKind(undefined, true)).toBe('professional');
  });

  describe('unverified accounts', () => {
    it.each(['AGENT', 'COMPANY'] as const)(
      'an unverified %s gets the public-only tabs, never the workspace/CRM tabs',
      (accountType) => {
        expect(resolveMainTabsKind(accountType, false)).toBe('publicOnly');
      },
    );

    it('an unknown accountType that is unverified is public-only (fails closed)', () => {
      expect(resolveMainTabsKind(undefined, false)).toBe('publicOnly');
    });

    it('an unverified CLIENT keeps the (already marketplace-only) client tabs', () => {
      expect(resolveMainTabsKind('CLIENT', false)).toBe('client');
    });

    it('completing verification switches an AGENT/COMPANY to the professional tabs', () => {
      expect(resolveMainTabsKind('AGENT', false)).toBe('publicOnly');
      expect(resolveMainTabsKind('AGENT', true)).toBe('professional');
      expect(resolveMainTabsKind('COMPANY', false)).toBe('publicOnly');
      expect(resolveMainTabsKind('COMPANY', true)).toBe('professional');
    });
  });
});
