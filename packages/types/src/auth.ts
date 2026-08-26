export type AccountType = 'CLIENT' | 'AGENT' | 'COMPANY';

export type AccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

/** Safe, public shape of a user — never includes passwordHash or any secret. */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  accountType: AccountType;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime, in seconds. */
  expiresIn: number;
}
