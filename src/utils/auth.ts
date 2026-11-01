/**
 * JWT authentication for the FinSync frontend.
 *
 * Two ways to get a session token (no anonymous or hard-coded logins):
 *  1. Inside Telegram (Mini App): send the signed `Telegram.WebApp.initData`;
 *     the backend verifies the signature with the bot token and checks the allowlist.
 *  2. In a browser: open the link from the bot's /dashboard command. It carries a
 *     one-time `?login=<code>` that is exchanged for a session token and removed from the URL.
 *
 * All callers share one in-flight sign-in, so a one-time code is never exchanged twice
 * (several requests start at once, and React StrictMode mounts effects twice in development).
 */

const TOKEN_STORAGE_KEY = 'family_budget_jwt_token';

let cachedToken: string | null = null;
let pendingSignIn: Promise<string> | null = null;

interface TokenResponse {
  access_token?: string;
}

async function requestToken(url: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return '';
  }
  const data = (await res.json()) as TokenResponse;
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

function readStoredToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored && stored.length > 20 ? stored : null;
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  cachedToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private mode): the token then lives only in memory.
  }
}

async function signIn(): Promise<string> {
  const loginCode = takeLoginCodeFromUrl();
  if (loginCode) {
    clearAuthToken();
    const token = await requestToken('/api/auth/exchange', { code: loginCode }).catch(() => '');
    if (token) {
      storeToken(token);
      return token;
    }
  }

  if (cachedToken) return cachedToken;
  const stored = readStoredToken();
  if (stored) {
    cachedToken = stored;
    return stored;
  }

  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return '';

  const token = await requestToken('/api/auth/telegram', { init_data: initData }).catch((err) => {
    console.warn('[Auth] Telegram authentication failed:', err);
    return '';
  });
  if (token) storeToken(token);
  return token;
}

/** The active JWT, signing in if needed. Returns '' when the user is not authenticated. */
export function getAuthToken(): Promise<string> {
  if (!pendingSignIn) {
    pendingSignIn = signIn().finally(() => {
      pendingSignIn = null;
    });
  }
  return pendingSignIn;
}

/** Forget the stored token (logout, or the server rejected it). */
export function clearAuthToken(): void {
  cachedToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Member id of the signed-in person, read from the (public) JWT claims. null if unknown. */
export async function getCurrentMemberId(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { member_id?: string | null };
    return claims.member_id ?? null;
  } catch {
    return null;
  }
}

/**
 * fetch() with the Bearer token. On 401 it signs in once more (inside Telegram a fresh initData
 * works; in a browser the person has to open a new link from the bot).
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const send = async (token: string) => {
    const headers = new Headers(init?.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await send(await getAuthToken());
  if (response.status !== 401) return response;

  clearAuthToken();
  const fresh = await getAuthToken();
  return fresh ? send(fresh) : response;
}

/** Test helper: reset module state between tests. */
export function __resetAuthForTests(): void {
  cachedToken = null;
  pendingSignIn = null;
}
