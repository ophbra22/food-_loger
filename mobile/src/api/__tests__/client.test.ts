import { createApiClient } from '../client';
import { createApi } from '../endpoints';
import { ApiError } from '../errors';
import { errorMessageKey } from '../messages';

type Call = { url: string; init: RequestInit };

function setup(
  respond: (call: Call) => Response | Promise<Response>,
  options: { token?: string | null; baseUrl?: string } = {},
) {
  const calls: Call[] = [];
  const rejected: string[] = [];
  const state = { token: options.token === undefined ? 'T'.repeat(43) : options.token };
  const client = createApiClient({
    baseUrl: () => options.baseUrl ?? 'http://server.test',
    token: () => state.token,
    onSessionRejected: (token) => rejected.push(token),
    fetch: (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    }) as unknown as typeof fetch,
  });
  return { api: createApi(client), client, calls, rejected, state };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const header = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];
const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('Expected the request to fail');
};

describe('authentication', () => {
  it('signs in as a native client and never uses cookies', async () => {
    const { api, calls } = setup(() => json({ user: { id: 'u1', username: 'alice' }, session_token: 't' }), {
      token: null,
    });
    await api.login('alice', 'long-enough-password');
    expect(calls[0].url).toBe('http://server.test/api/auth/login');
    expect(header(calls[0], 'X-FoodLogger-Request')).toBe('1');
    expect(header(calls[0], 'X-FoodLogger-Client')).toBe('mobile');
    expect(header(calls[0], 'Authorization')).toBeUndefined();
    expect(calls[0].init.credentials).toBe('omit');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: 'alice',
      password: 'long-enough-password',
    });
  });
  it('sends the session token as a bearer credential', async () => {
    const { api, calls } = setup(() => json({ day: '2026-10-11', meals: [], summary: {} }));
    await api.day('2026-10-11');
    expect(header(calls[0], 'Authorization')).toBe('Bearer ' + 'T'.repeat(43));
    expect(calls[0].url).toBe('http://server.test/api/meals?day=2026-10-11');
  });
  it('does not contact the server for private data without a session', async () => {
    const { api, calls } = setup(() => json({}), { token: null });
    const error = await failure(api.day('2026-10-11'));
    expect(error.kind).toBe('unauthorized');
    expect(calls).toHaveLength(0);
  });
  it('reports an expired session once, with the token that was rejected', async () => {
    const { api, rejected } = setup(() => json({ detail: 'Sign in to access your journal.' }, 401));
    const error = await failure(api.day('2026-10-11'));
    expect(error.kind).toBe('unauthorized');
    expect(rejected).toEqual(['T'.repeat(43)]);
    expect(errorMessageKey(error)).toBe('auth.sessionExpired');
  });
  it('a wrong password is not treated as an expired session', async () => {
    const { api, rejected } = setup(() => json({ detail: 'Invalid username or credentials.' }, 401), {
      token: null,
    });
    const error = await failure(api.login('alice', 'wrong-password-here'));
    expect(rejected).toEqual([]);
    expect(errorMessageKey(error, 'signIn')).toBe('auth.invalidCredentials');
  });
});

describe('saving meals', () => {
  it('sends the draft key as Idempotency-Key', async () => {
    const { api, calls } = setup(() => json({ id: 'm1' }, 201));
    await api.addMeal(
      { food_id: 'banana', grams: 150, day: '2026-10-11', meal_type: 'snack' },
      'draft-key-0000000001',
    );
    expect(header(calls[0], 'Idempotency-Key')).toBe('draft-key-0000000001');
    expect(calls[0].init.method).toBe('POST');
    await api.addCustomMeal(
      {
        name: 'Hummus',
        brand: '',
        barcode: null,
        grams: 80,
        basis_unit: 'g',
        day: '2026-10-11',
        meal_type: 'lunch',
        nutrition: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 },
        source: 'manual',
        raw_nutriments: {},
      },
      'draft-key-0000000002',
    );
    expect(calls[1].url).toBe('http://server.test/api/meals/custom');
    expect(header(calls[1], 'Idempotency-Key')).toBe('draft-key-0000000002');
  });
});

describe('failures', () => {
  it('maps statuses to kinds and messages', async () => {
    const cases: [number, string, Parameters<typeof errorMessageKey>[1], string][] = [
      [409, 'conflict', 'register', 'auth.usernameTaken'],
      [404, 'notFound', 'product', 'barcode.notFoundBody'],
      [503, 'unavailable', 'product', 'barcode.unavailableBody'],
      [503, 'unavailable', 'photo', 'photo.modelUnavailable'],
      [422, 'validation', 'photo', 'photo.imageRejected'],
      [422, 'validation', 'barcodePhoto', 'barcode.noBarcodeInPhoto'],
      [413, 'tooLarge', 'photo', 'errors.tooLarge'],
      [404, 'notFound', 'delete', 'meal.alreadyGone'],
      [404, 'notFound', 'saveCatalog', 'errors.foodGone'],
      [500, 'server', 'general', 'errors.server'],
      [429, 'rateLimited', 'signIn', 'auth.tooManyAttempts'],
    ];
    for (const [status, kind, context, key] of cases) {
      const { api } = setup(() => json({ detail: 'x' }, status));
      const error = await failure(api.day('2026-10-11'));
      expect([status, error.kind]).toEqual([status, kind]);
      expect(errorMessageKey(error, context)).toBe(key);
    }
  });
  it('tells a busy image slot from a real rate limit', async () => {
    const busy = setup(() => json({ detail: 'busy' }, 429, { 'Retry-After': '3' }));
    const busyError = await failure(busy.api.day('2026-10-11'));
    expect(busyError.retryAfterSeconds).toBe(3);
    expect(errorMessageKey(busyError, 'photo')).toBe('errors.busy');
    const limited = setup(() => json({ detail: 'limit' }, 429, { 'Retry-After': '60' }));
    expect(errorMessageKey(await failure(limited.api.day('2026-10-11')), 'photo')).toBe(
      'errors.rateLimited',
    );
  });
  it('reports an unreachable server as a network error with an unknown outcome', async () => {
    const { api } = setup(() => {
      throw new TypeError('Network request failed');
    });
    const error = await failure(
      api.addMeal({ food_id: 'banana', grams: 1, day: '2026-10-11', meal_type: 'snack' }, 'k'.repeat(20)),
    );
    expect(error.kind).toBe('network');
    expect(error.outcomeUnknown).toBe(true);
    expect(errorMessageKey(error, 'saveCatalog')).toBe('review.saveUnknown');
  });
  it('gives up after the timeout', async () => {
    const { client } = setup(
      ({ init }) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const error = await failure(client.request('/api/health', { auth: false, timeoutMs: 20 }));
    expect(error.kind).toBe('timeout');
  });
  it('survives an HTML error page from a proxy or a sleeping host', async () => {
    const { api } = setup(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await failure(api.day('2026-10-11'));
    expect([error.kind, error.detail]).toEqual(['unavailable', null]);
  });
  it('refuses to run without a server address', async () => {
    const { api, calls } = setup(() => json({}), { baseUrl: '' });
    expect((await failure(api.foods())).kind).toBe('config');
    expect(calls).toHaveLength(0);
  });
});

describe('responses', () => {
  it('returns CSV as text and nothing for 204', async () => {
    const csv = setup(() => new Response('day,name\n2026-10-11,Banana\n', { status: 200 }));
    expect(await csv.api.exportCsv('2026-10-11')).toContain('Banana');
    const gone = setup(() => new Response(null, { status: 204 }));
    expect(await gone.api.deleteMeal('abc')).toBeNull();
    expect(gone.calls[0].init.method).toBe('DELETE');
  });
});
