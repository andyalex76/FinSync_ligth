/**
 * JWT Authentication utility for Family Budget frontend.
 * Interacts with /api/auth/telegram to acquire signed Bearer JWT tokens.
 */

let cachedToken: string | null = null;
let pendingAuthPromise: Promise<string> | null = null;

const TOKEN_STORAGE_KEY = 'family_budget_jwt_token';

/**
 * Retrieve the active JWT token, restoring from localStorage or acquiring via /api/auth/telegram.
 */
export async function getAuthToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  if (stored && stored.length > 20) {
    cachedToken = stored;
    return stored;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = (async () => {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: 123456789,
          first_name: 'Пользователь Web',
          username: 'family_web_user',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          cachedToken = data.access_token;
          if (typeof window !== 'undefined') {
            localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
          }
          return data.access_token;
        }
      }
    } catch (err) {
      console.warn('[Auth] Failed to obtain JWT token from backend:', err);
    } finally {
      pendingAuthPromise = null;
    }

    return '';
  })();

  return pendingAuthPromise;
}

/**
 * Clear stored token on logout or authorization failure.
 */
export function clearAuthToken(): void {
  cachedToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Enhanced fetch wrapper with automatic JWT Bearer token injection and retry on 401.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();

  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  // If token expired or invalid, refresh and retry once
  if (response.status === 401) {
    clearAuthToken();
    const freshToken = await getAuthToken();
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`);
      return fetch(input, {
        ...init,
        headers,
      });
    }
  }

  return response;
}
