export interface CityPrediction {
  label: string;
  description: string;
  place_id: string;
  latitude?: number;
  longitude?: number;
}

interface GooglePrediction {
  description?: string;
  place_id?: string;
  terms?: Array<{ value?: string }>;
}

interface NominatimResult {
  place_id?: string | number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

export function formatGoogleCityPrediction(prediction: GooglePrediction): CityPrediction | null {
  if (!prediction.place_id) return null;
  const terms = (prediction.terms || []).map((term) => term.value?.trim()).filter((value): value is string => Boolean(value));
  if (terms.length >= 2) {
    const country = terms.at(-1)!;
    const locality = terms.slice(0, -1).join(', ');
    const label = `${locality} — ${country}`;
    return { label, description: label, place_id: prediction.place_id };
  }
  const description = prediction.description?.trim();
  return description ? { label: description, description, place_id: prediction.place_id } : null;
}

export function formatNominatimCity(result: NominatimResult): CityPrediction | null {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.municipality || address.county;
  const state = address.state || address.region || address.state_district;
  const country = address.country;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!city || !country || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const locality = [city, state].filter(Boolean).join(', ');
  const label = `${locality} — ${country}`;
  return {
    label,
    description: label,
    place_id: String(result.place_id || `${latitude},${longitude}`),
    latitude,
    longitude,
  };
}
