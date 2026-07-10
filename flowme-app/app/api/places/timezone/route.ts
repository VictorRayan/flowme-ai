import { NextRequest } from 'next/server';
import timezoneLookup from '@photostructure/tz-lookup';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { isValidTimezone } from '@/lib/timezones/user-timezone';

interface Coordinates {
  latitude: number;
  longitude: number;
}

async function coordinatesForPlace(placeId: string, apiKey: string): Promise<Coordinates | null> {
  const params = new URLSearchParams({ place_id: placeId, fields: 'geometry', key: apiKey });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await response.json();
  const location = data?.result?.geometry?.location;
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

async function googleTimezone(coordinates: Coordinates, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({
    location: `${coordinates.latitude},${coordinates.longitude}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    key: apiKey,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?${params}`);
  const data = await response.json();
  return data?.status === 'OK' && typeof data.timeZoneId === 'string' && isValidTimezone(data.timeZoneId)
    ? data.timeZoneId
    : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('place_id')?.trim();
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    let coordinates: Coordinates | null = null;

    if (placeId && apiKey) coordinates = await coordinatesForPlace(placeId, apiKey);
    if (!coordinates) {
      const latitude = Number(searchParams.get('latitude'));
      const longitude = Number(searchParams.get('longitude'));
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) coordinates = { latitude, longitude };
    }
    if (!coordinates || coordinates.latitude < -90 || coordinates.latitude > 90 || coordinates.longitude < -180 || coordinates.longitude > 180) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Select a valid city');
    }

    const timezone = (apiKey ? await googleTimezone(coordinates, apiKey) : null)
      || timezoneLookup(coordinates.latitude, coordinates.longitude);
    if (!isValidTimezone(timezone)) return apiError(ErrorCode.INTERNAL_ERROR, 'Could not determine city timezone', 502);
    return apiSuccess({ timezone });
  } catch (error) {
    console.error('City Timezone Error:', error);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Could not determine city timezone', 502);
  }
}
