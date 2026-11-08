import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAuthForTests, authFetch, clearAuthToken, getAuthProblem, getAuthToken, getCurrentMemberId } from './auth';

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
    expect(localStorage.getItem('finsync_session_v2')).toBe(token);
  });

  it('reuses the stored token without any request', async () => {
    const token = fakeJwt({ member_id: 'm-1' });
    localStorage.setItem('finsync_session_v2', token);
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
    expect(localStorage.getItem('finsync_session_v2')).toBeNull();
  });

  it('reads the member id from the token claims', async () => {
    localStorage.setItem('finsync_session_v2', fakeJwt({ member_id: 'member-42' }));
    expect(await getCurrentMemberId()).toBe('member-42');
    clearAuthToken();
    expect(await getCurrentMemberId()).toBeNull();
  });

  it('authFetch sends the Bearer header and signs in again once after a 401', async () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'init' } };
    const first = fakeJwt({ member_id: 'one' });
    const second = fakeJwt({ member_id: 'two' });
    let authCalls = 0;
    const seen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (input === '/api/auth/telegram') return jsonResponse({ access_token: ++authCalls === 1 ? first : second });
      seen.push(new Headers(init?.headers).get('Authorization') ?? '');
      return seen.length === 1 ? jsonResponse({ detail: 'expired' }, 401) : jsonResponse({ ok: true });
    });

    const res = await authFetch('/api/dashboard');
    expect(res.status).toBe(200);
    expect(seen).toEqual([`Bearer ${first}`, `Bearer ${second}`]);
  });

  it('in a browser a rejected token is dropped and the original answer is returned (a new link is needed)', async () => {
    localStorage.setItem('finsync_session_v2', fakeJwt({ member_id: 'stale' }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ detail: 'Доступ запрещён' }, 403));

    const res = await authFetch('/api/dashboard');
    expect(res.status).toBe(403);
    expect(localStorage.getItem('finsync_session_v2')).toBeNull();
  });

  it('inside Telegram never reuses a stored token: it signs in with fresh initData and does not store it', async () => {
    localStorage.setItem('finsync_session_v2', fakeJwt({ member_id: 'stale-member' }));
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'fresh-init-data' } };
    const fresh = fakeJwt({ member_id: 'fresh-member' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ access_token: fresh }));

    expect(await getAuthToken()).toBe(fresh);
    expect(await getAuthToken()).toBe(fresh); // reused within this launch: no second request
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/telegram');
    expect(localStorage.getItem('finsync_session_v2')).not.toContain(fresh); // the fresh token stays in memory only
  });

  it('ignores tokens left by older versions of the app (old storage key)', async () => {
    localStorage.setItem('family_budget_jwt_token', fakeJwt({ member_id: 'old-app' }));
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await getAuthToken()).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authFetch also signs in again after a 403 inside Telegram (a stale session cannot get stuck)', async () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'init' } };
    const first = fakeJwt({ member_id: 'one' });
    const second = fakeJwt({ member_id: 'two' });
    let authCalls = 0;
    const seen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (input === '/api/auth/telegram') return jsonResponse({ access_token: ++authCalls === 1 ? first : second });
      seen.push(new Headers(init?.headers).get('Authorization') ?? '');
      return seen.length === 1 ? jsonResponse({ detail: 'Доступ запрещён' }, 403) : jsonResponse({ ok: true });
    });

    const res = await authFetch('/api/dashboard');
    expect(res.status).toBe(200);
    expect(seen).toEqual([`Bearer ${first}`, `Bearer ${second}`]);
  });

  it('remembers why sign-in failed: refused account vs. a bad link', async () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'x' } };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ detail: 'Доступ запрещён' }, 403));
    expect(await getAuthToken()).toBe('');
    expect(getAuthProblem()).toBe('forbidden');

    __resetAuthForTests();
    delete (window as { Telegram?: unknown }).Telegram;
    window.history.replaceState({}, '', '/?login=USED_CODE');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ detail: 'Ссылка недействительна' }, 401));
    expect(await getAuthToken()).toBe('');
    expect(getAuthProblem()).toBe('link');
  });
});
