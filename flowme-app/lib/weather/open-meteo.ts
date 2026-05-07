const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const weatherCache = new Map<string, CacheEntry<WeatherResult>>();
const geoCache = new Map<string, CacheEntry<Coords>>();

export interface Coords {
  lat: number;
  lon: number;
  name: string;
  country: string;
  timezone: string;
}

export interface WeatherResult {
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
    timezone: string;
  };
  current: {
    time: string;
    temperature_c: number;
    feels_like_c: number;
    humidity_pct: number;
    wind_kph: number;
    wind_direction_deg: number;
    precipitation_mm: number;
    weather_code: number;
    description: string;
    is_day: boolean;
  };
  forecast: Array<{
    date: string;
    temp_max_c: number;
    temp_min_c: number;
    precipitation_sum_mm: number;
    weather_code: number;
    description: string;
  }>;
  fetched_at: string;
}

// WMO Weather Interpretation Codes → human label
// https://open-meteo.com/en/docs#weathervariables
function wmoDescription(code: number): string {
  if (code === 0)  return 'Clear sky';
  if (code === 1)  return 'Mainly clear';
  if (code === 2)  return 'Partly cloudy';
  if (code === 3)  return 'Overcast';
  if (code <= 49)  return 'Fog';
  if (code <= 59)  return 'Drizzle';
  if (code <= 69)  return 'Rain';
  if (code <= 79)  return 'Snow';
  if (code <= 82)  return 'Rain showers';
  if (code <= 84)  return 'Snow showers';
  if (code <= 86)  return 'Heavy snow showers';
  if (code <= 99)  return 'Thunderstorm';
  return 'Unknown';
}

export async function geocodeCity(city: string): Promise<Coords> {
  const key = city.trim().toLowerCase();
  const cached = geoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);

  const json = await res.json();
  const result = json?.results?.[0];
  if (!result) throw new Error(`City not found: "${city}"`);

  const coords: Coords = {
    lat: result.latitude,
    lon: result.longitude,
    name: result.name,
    country: result.country ?? result.country_code ?? '',
    timezone: result.timezone ?? 'UTC',
  };

  geoCache.set(key, { data: coords, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
  return coords;
}

export async function fetchWeather(coords: Coords): Promise<WeatherResult> {
  const cacheKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'weather_code',
      'is_day',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'weather_code',
    ].join(','),
    timezone: coords.timezone,
    forecast_days: '5',
  });

  const res = await fetch(`${WEATHER_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather fetch failed: HTTP ${res.status}`);

  const json = await res.json();
  const c = json.current;
  const d = json.daily;

  const result: WeatherResult = {
    location: {
      name: coords.name,
      country: coords.country,
      lat: coords.lat,
      lon: coords.lon,
      timezone: coords.timezone,
    },
    current: {
      time: c.time,
      temperature_c: c.temperature_2m,
      feels_like_c: c.apparent_temperature,
      humidity_pct: c.relative_humidity_2m,
      wind_kph: c.wind_speed_10m,
      wind_direction_deg: c.wind_direction_10m,
      precipitation_mm: c.precipitation,
      weather_code: c.weather_code,
      description: wmoDescription(c.weather_code),
      is_day: c.is_day === 1,
    },
    forecast: (d.time as string[]).map((date: string, i: number) => ({
      date,
      temp_max_c: d.temperature_2m_max[i],
      temp_min_c: d.temperature_2m_min[i],
      precipitation_sum_mm: d.precipitation_sum[i],
      weather_code: d.weather_code[i],
      description: wmoDescription(d.weather_code[i]),
    })),
    fetched_at: new Date().toISOString(),
  };

  weatherCache.set(cacheKey, { data: result, expiresAt: Date.now() + WEATHER_CACHE_TTL_MS });
  return result;
}

export async function getWeather(opts: {
  city?: string;
  lat?: number;
  lon?: number;
  locationName?: string;
}): Promise<WeatherResult> {
  if (opts.lat !== undefined && opts.lon !== undefined) {
    const coords: Coords = {
      lat: opts.lat,
      lon: opts.lon,
      name: opts.locationName || 'Your location',
      country: '',
      timezone: 'auto',
    };
    // Open-Meteo supports timezone=auto which resolves from lat/lon
    return fetchWeather(coords);
  }

  if (opts.city) {
    const coords = await geocodeCity(opts.city);
    return fetchWeather(coords);
  }

  throw new Error('Provide city name or lat/lon coordinates');
}
