import type { User } from '@prisma/client';

/** Shape attached to `req.user` by JwtStrategy once a request is authenticated. */
export interface AuthenticatedRequestUser {
  userId: string;
  sessionId: string;
  user: User;
}

export interface JwtAccessPayload {
  sub: string;
  sid: string;
}
