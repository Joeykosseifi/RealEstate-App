import {
  NOT_NOW_LABEL,
  VERIFICATION_PROMPT_TITLE,
  VERIFY_ACCOUNT_LABEL,
  buildVerificationPromptButtons,
  guardVerifiedAction,
  isAccountVerified,
  verificationPromptMessage,
} from './accountVerification';

const now = '2026-01-01T00:00:00.000Z';

describe('isAccountVerified', () => {
  it('requires both email and phone verification', () => {
    expect(isAccountVerified({ emailVerifiedAt: now, phoneVerifiedAt: now })).toBe(true);
    expect(isAccountVerified({ emailVerifiedAt: now, phoneVerifiedAt: null })).toBe(false);
    expect(isAccountVerified({ emailVerifiedAt: null, phoneVerifiedAt: now })).toBe(false);
    expect(isAccountVerified({ emailVerifiedAt: null, phoneVerifiedAt: null })).toBe(false);
  });

  it('treats a missing user as unverified (fails closed)', () => {
    expect(isAccountVerified(null)).toBe(false);
    expect(isAccountVerified(undefined)).toBe(false);
  });
});

describe('guardVerifiedAction (e.g. Add Property)', () => {
  it('an unverified account is prompted to verify and the action never runs', () => {
    const onAllowed = jest.fn();
    const onBlocked = jest.fn();
    guardVerifiedAction(false, onAllowed, onBlocked);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onAllowed).not.toHaveBeenCalled();
  });

  it('a verified account runs the action without a prompt', () => {
    const onAllowed = jest.fn();
    const onBlocked = jest.fn();
    guardVerifiedAction(true, onAllowed, onBlocked);
    expect(onAllowed).toHaveBeenCalledTimes(1);
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

describe('verification prompt', () => {
  it('uses the agreed title and message for adding properties', () => {
    expect(VERIFICATION_PROMPT_TITLE).toBe('Verification required');
    expect(verificationPromptMessage()).toBe(
      'Please verify your account before adding properties to ProBase.',
    );
  });

  it('offers exactly "Not Now" (cancel) and "Verify Account"', () => {
    const buttons = buildVerificationPromptButtons({ onVerify: jest.fn() });
    expect(buttons.map((b) => b.text)).toEqual([NOT_NOW_LABEL, VERIFY_ACCOUNT_LABEL]);
    expect(buttons[0]).toMatchObject({ text: 'Not Now', style: 'cancel' });
    expect(buttons[1]).toMatchObject({ text: 'Verify Account', style: 'default' });
  });

  it('"Verify Account" opens the verification screen (and only that)', () => {
    const onVerify = jest.fn();
    const onDismiss = jest.fn();
    const verifyButton = buildVerificationPromptButtons({ onVerify, onDismiss }).find(
      (b) => b.text === VERIFY_ACCOUNT_LABEL,
    )!;
    verifyButton.onPress();
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('"Not Now" just dismisses — it never opens verification', () => {
    const onVerify = jest.fn();
    const onDismiss = jest.fn();
    const notNow = buildVerificationPromptButtons({ onVerify, onDismiss }).find(
      (b) => b.text === NOT_NOW_LABEL,
    )!;
    notNow.onPress();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it('"Not Now" with no handler is a safe no-op (user stays where they were)', () => {
    const onVerify = jest.fn();
    const notNow = buildVerificationPromptButtons({ onVerify }).find(
      (b) => b.text === NOT_NOW_LABEL,
    )!;
    expect(() => notNow.onPress()).not.toThrow();
    expect(onVerify).not.toHaveBeenCalled();
  });
});
