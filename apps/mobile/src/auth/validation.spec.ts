import {
  isRegistrationFormValid,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
  validateRegistrationForm,
  type RegistrationFormValues,
} from './validation';

function baseValues(overrides: Partial<RegistrationFormValues> = {}): RegistrationFormValues {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    password: 'correct-horse',
    confirmPassword: 'correct-horse',
    acceptedTerms: true,
    accountType: 'CLIENT',
    companyName: '',
    ...overrides,
  };
}

describe('validateEmail', () => {
  it('rejects an empty email', () => {
    expect(validateEmail('')).toBeDefined();
  });

  it('rejects a malformed email', () => {
    expect(validateEmail('not-an-email')).toBeDefined();
  });

  it('accepts a valid email', () => {
    expect(validateEmail('agent@example.com')).toBeUndefined();
  });
});

describe('validatePhone', () => {
  it('rejects an empty phone', () => {
    expect(validatePhone('')).toBeDefined();
  });

  it('rejects a phone without a country code', () => {
    expect(validatePhone('5551234567')).toBeDefined();
  });

  it('accepts a valid international phone number', () => {
    expect(validatePhone('+15551234567')).toBeUndefined();
  });
});

describe('validatePassword', () => {
  it('rejects a password shorter than 8 characters', () => {
    expect(validatePassword('short')).toBeDefined();
  });

  it('rejects a password longer than 128 characters', () => {
    expect(validatePassword('a'.repeat(129))).toBeDefined();
  });

  it('accepts an 8+ character password', () => {
    expect(validatePassword('longenough')).toBeUndefined();
  });
});

describe('validatePasswordConfirmation', () => {
  it('rejects a mismatched confirmation', () => {
    expect(validatePasswordConfirmation('secret123', 'different')).toBeDefined();
  });

  it('rejects an empty confirmation', () => {
    expect(validatePasswordConfirmation('secret123', '')).toBeDefined();
  });

  it('accepts a matching confirmation', () => {
    expect(validatePasswordConfirmation('secret123', 'secret123')).toBeUndefined();
  });
});

describe('validateRegistrationForm — client registration', () => {
  it('accepts a fully valid client form', () => {
    expect(validateRegistrationForm(baseValues())).toEqual({});
    expect(isRegistrationFormValid(baseValues())).toBe(true);
  });

  it('flags missing required fields', () => {
    const errors = validateRegistrationForm(
      baseValues({ firstName: '', lastName: '', password: '', confirmPassword: '' }),
    );
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  it('rejects registration when terms are not accepted', () => {
    const errors = validateRegistrationForm(baseValues({ acceptedTerms: false }));
    expect(errors.acceptedTerms).toBeDefined();
    expect(isRegistrationFormValid(baseValues({ acceptedTerms: false }))).toBe(false);
  });
});

describe('validateRegistrationForm — agent registration', () => {
  it('accepts a valid agent form with no company fields required', () => {
    const errors = validateRegistrationForm(baseValues({ accountType: 'AGENT' }));
    expect(errors).toEqual({});
  });
});

describe('validateRegistrationForm — company registration', () => {
  it('requires a company name for COMPANY accounts', () => {
    const errors = validateRegistrationForm(
      baseValues({ accountType: 'COMPANY', companyName: '' }),
    );
    expect(errors.companyName).toBeDefined();
  });

  it('accepts a valid company form once companyName is set', () => {
    const errors = validateRegistrationForm(
      baseValues({ accountType: 'COMPANY', companyName: 'Acme Realty' }),
    );
    expect(errors).toEqual({});
  });

  it('does not require companyName for non-company account types', () => {
    const errors = validateRegistrationForm(baseValues({ accountType: 'CLIENT', companyName: '' }));
    expect(errors.companyName).toBeUndefined();
  });
});
