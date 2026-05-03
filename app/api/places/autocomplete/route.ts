import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req); // enforce auth
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 3) {
      return apiSuccess({ predictions: [] });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      // Use Google Places API
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`);
      const data = await response.json();
      
      if (data.status === 'OK') {
        const predictions = data.predictions.map((p: any) => ({
          description: p.description,
          place_id: p.place_id,
        }));
        return apiSuccess({ predictions });
      }
      return apiSuccess({ predictions: [] });
    } else {
      // Fallback to OpenStreetMap Nominatim
      // Note: Nominatim requires a valid user-agent by their ToS
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`, {
        headers: {
            'User-Agent': 'FlowMeApp/1.0 (local development)',
            'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (!response.ok) {
        return apiSuccess({ predictions: [] }); // Soft fail
      }

      const data = await response.json();
      
      const predictions = (data || []).map((p: any) => ({
        description: p.display_name,
        place_id: p.place_id.toString(),
      }));
      
      return apiSuccess({ predictions });
    }
  } catch (err) {
    console.error('Places AutoComplete Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch places');
  }
}
