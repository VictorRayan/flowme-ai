import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { formatGoogleCityPrediction, formatNominatimCity } from '@/lib/location/cities';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req); // enforce auth
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return apiSuccess({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const language = searchParams.get('language') || 'pt-BR';

    if (apiKey) {
      const params = new URLSearchParams({ input: query.trim(), key: apiKey, types: '(cities)', language });
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      const data = await response.json();
      
      if (data.status === 'OK') {
        const predictions = (Array.isArray(data.predictions) ? data.predictions : [])
          .map(formatGoogleCityPrediction)
          .filter(Boolean);
        return apiSuccess({ predictions });
      }
      return apiSuccess({ predictions: [] });
    } else {
      const params = new URLSearchParams({ q: query.trim(), format: 'json', addressdetails: '1', limit: '7' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
            'User-Agent': 'FlowMeApp/1.0 (local development)',
            'Accept-Language': language,
        }
      });
      
      if (!response.ok) {
        return apiSuccess({ predictions: [] });
      }

      const data = await response.json();
      const predictions = (Array.isArray(data) ? data : [])
        .map(formatNominatimCity)
        .filter(Boolean)
        .slice(0, 5);
      
      return apiSuccess({ predictions });
    }
  } catch (err) {
    console.error('Places AutoComplete Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch places');
  }
}
