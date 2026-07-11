import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/errors';
import { resolveRequestCountry } from '@/lib/billing/ip-country';

export async function GET(req: NextRequest) {
  try {
    const countryCode = await resolveRequestCountry(req.headers);
    return apiSuccess({ countryCode, pixAvailable: countryCode === 'BR' });
  } catch (error) {
    return apiSuccess({ countryCode: null, pixAvailable: false });
  }
}
