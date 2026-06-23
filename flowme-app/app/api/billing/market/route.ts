import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { resolveRequestCountry } from '@/lib/billing/ip-country';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const countryCode = await resolveRequestCountry(req.headers);
    return apiSuccess({ countryCode, pixAvailable: countryCode === 'BR' });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiSuccess({ countryCode: null, pixAvailable: false });
  }
}
