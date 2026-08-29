import { resolveRootRoute } from './resolveInitialRoute';

describe('resolveRootRoute', () => {
  it('shows the loading state while the session is being restored', () => {
    expect(resolveRootRoute({ status: 'loading' })).toBe('loading');
  });

  it('routes a signed-out user to the auth flow', () => {
    expect(resolveRootRoute({ status: 'signed-out' })).toBe('auth');
  });

  it('routes a signed-in PENDING_VERIFICATION account to the verification screen', () => {
    expect(resolveRootRoute({ status: 'signed-in', accountStatus: 'PENDING_VERIFICATION' })).toBe(
      'verification',
    );
  });

  it('routes a signed-in ACTIVE account into the app', () => {
    expect(resolveRootRoute({ status: 'signed-in', accountStatus: 'ACTIVE' })).toBe('app');
  });

  it('never leaves a PENDING_VERIFICATION account in the main app', () => {
    const route = resolveRootRoute({ status: 'signed-in', accountStatus: 'PENDING_VERIFICATION' });
    expect(route).not.toBe('app');
  });
});
