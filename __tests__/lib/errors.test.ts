import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

describe('apiSuccess', () => {
  it('returns 200 with ok:true', async () => {
    const res = apiSuccess({ foo: 'bar' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.foo).toBe('bar');
  });

  it('returns 200 with empty data when called with no args', async () => {
    const res = apiSuccess();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('apiError', () => {
  it('returns the given status code', async () => {
    const res = apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    expect(res.status).toBe(401);
  });

  it('returns ok:false with error object', async () => {
    const res = apiError(ErrorCode.VALIDATION_ERROR, 'Bad input');
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Bad input');
  });

  it('defaults to 400 when no status provided', async () => {
    const res = apiError(ErrorCode.VALIDATION_ERROR, 'Bad');
    expect(res.status).toBe(400);
  });

  it('returns NOT_FOUND at 404', async () => {
    const res = apiError(ErrorCode.NOT_FOUND, 'Missing', 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
