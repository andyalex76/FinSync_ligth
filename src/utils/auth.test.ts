import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAuthForTests, authFetch, clearAuthToken, getAuthToken, getCurrentMemberId } from './auth';

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = (claims: object) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.signaturesignaturesignature`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAuthForTests();
    window.history.replaceState({}, '', '/');
    delete (window as { Telegram?: unknown }).Telegram;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty token and never calls the API without any credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await getAuthToken()).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges the one-time login code once, even for concurrent callers, and cleans the URL', async () => {
    window.history.replaceState({}, '', '/?login=ONE_TIME_CODE&x=1');
    const token = fakeJwt({ member_id: 'm-1' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ access_token: token }));

    const results = await Promise.all([getAuthToken(), getAuthToken(), getAuthToken()]);

    expect(results).toEqual([token, token, token]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/exchange');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ code: 'ONE_TIME_CODE' });
    expect(window.location.search).toBe('?x=1');
    expect(localStorage.getItem('family_budget_jwt_token')).toBe(token);
  });

  it('reuses the stored token without any request', async () => {
    const token = fakeJwt({ member_id: 'm-1' });
    localStorage.setItem('family_budget_jwt_token', token);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await getAuthToken()).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in with Telegram initData inside the Mini App', async () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'query_id=1&hash=abc' } };
    const token = fakeJwt({ member_id: 'm-2' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ access_token: token }));

    expect(await getAuthToken()).toBe(token);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/telegram');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ init_data: 'query_id=1&hash=abc' });
  });

  it('gives an empty token when the server refuses (not in the allowlist)', async () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'x' } };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ detail: 'Доступ запрещён' }, 403));
    expect(await getAuthToken()).toBe('');
    expect(localStorage.getItem('family_budget_jwt_token')).toBeNull();
  });

  it('reads the member id from the token claims', async () => {
    localStorage.setItem('family_budget_jwt_token', fakeJwt({ member_id: 'member-42' }));
    expect(await getCurrentMemberId()).toBe('member-42');
    clearAuthToken();
    expect(await getCurrentMemberId()).toBeNull();
  });

  it('authFetch sends the Bearer header and signs in again once after a 401', async () => {
    const stale = fakeJwt({ member_id: 'old' });
    const fresh = fakeJwt({ member_id: 'new' });
    localStorage.setItem('family_budget_jwt_token', stale);
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'fresh-init-data' } };

    const seen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (input === '/api/auth/telegram') return jsonResponse({ access_token: fresh });
      seen.push(new Headers(init?.headers).get('Authorization') ?? '');
      return seen.length === 1 ? jsonResponse({ detail: 'expired' }, 401) : jsonResponse({ ok: true });
    });

    const res = await authFetch('/api/dashboard');
    expect(res.status).toBe(200);
    expect(seen).toEqual([`Bearer ${stale}`, `Bearer ${fresh}`]);
  });
});
