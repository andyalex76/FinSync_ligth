/**
 * JWT authentication for the FinSync frontend.
 *
 * Two ways to get a session token (no anonymous or hard-coded logins):
 *  1. Inside Telegram (Mini App): send the signed `Telegram.WebApp.initData`;
 *     the backend verifies the signature with the bot token and checks the allowlist.
 *  2. In a browser: open the link from the bot's /dashboard command. It carries a
 *     one-time `?login=<code>` that is exchanged for a session token and removed from the URL.
 */

let cachedToken: string | null = null;
let pendingAuthPromise: Promise<string> | null = null;

const TOKEN_STORAGE_KEY = 'family_budget_jwt_token';

async function requestToken(url: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return '';
  }
  const data = await res.json();
  return typeof data.access_token === 'string' ? data.access_token : '';
}

function takeLoginCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('login');
  if (!code) return null;
  // Remove the one-time code from the address bar and browser history right away.
  url.searchParams.delete('login');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  return code;
}

function storeToken(token: string): void {
  cachedToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

/**
 * Retrieve the active JWT. Returns '' when the user is not authenticated.
 */
export async function getAuthToken(): Promise<string> {
  const loginCode = takeLoginCodeFromUrl();
  if (loginCode) {
    clearAuthToken();
    const token = await requestToken('/api/auth/exchange', { code: loginCode }).catch(() => '');
    if (token) {
      storeToken(token);
      return token;
    }
  }

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

  const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';
  if (!initData) {
    return '';
  }

  pendingAuthPromise = (async () => {
    try {
      const token = await requestToken('/api/auth/telegram', { init_data: initData });
      if (token) {
        storeToken(token);
      }
      return token;
    } catch (err) {
      console.warn('[Auth] Telegram authentication failed:', err);
      return '';
    } finally {
      pendingAuthPromise = null;
    }
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
 * Fetch wrapper with automatic JWT Bearer injection. On 401 inside Telegram it re-authenticates
 * once with fresh initData; in a browser the user must open a new link from the bot.
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
