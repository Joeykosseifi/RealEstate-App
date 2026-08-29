import { resolveMainTabsKind } from './roleRouting';

describe('resolveMainTabsKind', () => {
  it('routes CLIENT accounts to the client tabs', () => {
    expect(resolveMainTabsKind('CLIENT')).toBe('client');
  });

  it('routes AGENT accounts to the professional tabs', () => {
    expect(resolveMainTabsKind('AGENT')).toBe('professional');
  });

  it('routes COMPANY accounts to the professional tabs', () => {
    expect(resolveMainTabsKind('COMPANY')).toBe('professional');
  });

  it('never routes a client to the professional tabs and vice versa', () => {
    expect(resolveMainTabsKind('CLIENT')).not.toBe(resolveMainTabsKind('AGENT'));
    expect(resolveMainTabsKind('CLIENT')).not.toBe(resolveMainTabsKind('COMPANY'));
  });

  it('defaults to professional when accountType is unknown (never silently becomes a client)', () => {
    expect(resolveMainTabsKind(undefined)).toBe('professional');
  });
});
