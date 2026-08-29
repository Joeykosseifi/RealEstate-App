import * as SecureStore from 'expo-secure-store';

/**
 * Falls back to localhost for local development — set
 * `EXPO_PUBLIC_API_URL` in `.env` for a device/simulator that can't
 * reach your machine's localhost (see docs/API.md "Mobile setup").
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'realestate.accessToken';
const REFRESH_TOKEN_KEY = 'realestate.refreshToken';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** multipart/form-data body — pass a pre-built FormData instead of `body`. */
  formData?: FormData;
}

/**
 * A single fetch wrapper for every API call. Attaches the stored access
 * token (unless `auth: false`) and throws `ApiError` for any non-2xx
 * response so screens can catch one error type. Does NOT attempt
 * refresh-token rotation here — that belongs to a session-management
 * layer this milestone doesn't build; a `401` currently just surfaces to
 * the caller (see `AuthContext`, which logs the user out on one).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
    // Deliberately no Content-Type header — fetch sets the multipart
    // boundary itself when the body is a FormData instance.
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  if (options.auth !== false) {
    const token = await getStoredAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const rawMessage =
      data && typeof data === 'object' && 'message' in data
        ? (data as { message: unknown }).message
        : null;
    // The backend's ValidationPipe returns an array of messages when
    // several fields fail at once (see docs/API.md) — join them into one
    // readable string rather than showing "field1,field2" (Array#toString).
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('\n')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}
