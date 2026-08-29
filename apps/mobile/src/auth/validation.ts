import type { AccountType } from '../api/types';

/**
 * Client-side registration validation (Milestone 6.1). Mirrors the
 * backend's actual rules (`RegisterBaseDto`/`RegisterCompanyDto`,
 * `PasswordService`, `UsersService.normalizePhone` — see
 * docs/API.md "Authentication") so a user gets fast feedback, but the
 * backend remains the sole authority: every field here is re-validated
 * server-side, and a server rejection (e.g. an edge case in phone
 * formatting this function doesn't catch) is always shown too.
 */

export interface RegistrationFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  accountType: AccountType;
  companyName: string;
}

export type RegistrationFormErrors = Partial<Record<keyof RegistrationFormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose E.164 check (leading '+', 8-15 digits) — the backend's
// libphonenumber-js validation is the real authority; this just catches
// the common "forgot the country code" mistake before a round-trip.
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validatePhone(phone: string): string | undefined {
  if (!phone.trim()) return 'Phone number is required.';
  if (!PHONE_PATTERN.test(phone.trim())) {
    return 'Enter a phone number with country code, e.g. +15551234567.';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
): string | undefined {
  if (!confirmPassword) return 'Confirm your password.';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return undefined;
}

export function validateRequired(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is required.`;
}

/** Validates the whole registration form; returns an empty object when valid. */
export function validateRegistrationForm(values: RegistrationFormValues): RegistrationFormErrors {
  const errors: RegistrationFormErrors = {};

  const firstNameError = validateRequired(values.firstName, 'First name');
  if (firstNameError) errors.firstName = firstNameError;

  const lastNameError = validateRequired(values.lastName, 'Last name');
  if (lastNameError) errors.lastName = lastNameError;

  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;

  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;

  const confirmError = validatePasswordConfirmation(values.password, values.confirmPassword);
  if (confirmError) errors.confirmPassword = confirmError;

  if (!values.acceptedTerms) {
    errors.acceptedTerms = 'You must accept the terms to register.';
  }

  if (values.accountType === 'COMPANY') {
    const companyNameError = validateRequired(values.companyName, 'Company name');
    if (companyNameError) errors.companyName = companyNameError;
  }

  return errors;
}

export function isRegistrationFormValid(values: RegistrationFormValues): boolean {
  return Object.keys(validateRegistrationForm(values)).length === 0;
}
