/**
 * Shape of every error response returned by apps/api. Kept intentionally
 * generic here — domain-specific error codes are added by the modules
 * that introduce them, not by this foundation package.
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}
