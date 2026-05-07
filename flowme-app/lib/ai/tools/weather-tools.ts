import { z } from 'zod';
import { defineTool } from './Tool';
import { getWeather } from '@/lib/weather/open-meteo';

export const weatherGetTool = defineTool({
  name: 'weather.get',
  description: `Fetches current weather and a 5-day forecast for a location.

WHEN TO USE:
- User asks about the weather anywhere ("what's the weather in São Paulo?", "is it going to rain tomorrow?", "how hot is it in London?").
- User asks about "my weather" or "weather here" — use the userLocation from context when available (lat/lon injected at runtime).

HOW TO CALL:
- For a named city: pass city = "São Paulo" (or any city name).
- For the user's current location (GPS from browser): pass lat and lon from context.userLocation.
- Never fabricate coordinates. If you don't have the user's location and they didn't name a city, ask them for it.

WHAT YOU RECEIVE:
- current: temperature, feels-like, humidity, wind, precipitation, description (e.g. "Partly cloudy").
- forecast: 5 days of max/min temp, precipitation, and description.
- All temperatures are in Celsius.

HOW TO REPLY:
- Speak the numbers naturally. "It's 28 degrees, feels like 31, with some clouds."
- For forecasts: narrate key days, don't recite every row.
- Don't say "the receipt shows" or read out JSON.`,

  isReadOnly: true,

  inputSchema: z.object({
    city: z.string().optional().describe(
      'City name, e.g. "São Paulo", "London", "Tokyo". Use when user names a place.'
    ),
    lat: z.number().optional().describe(
      "User's latitude from browser GPS. Use when user asks about 'my location' or 'here'."
    ),
    lon: z.number().optional().describe(
      "User's longitude from browser GPS."
    ),
    location_name: z.string().optional().describe(
      "Human-readable name for lat/lon location when known, e.g. 'Your location'."
    ),
  }),

  call: async (args, context) => {
    try {
      // If no city and no explicit lat/lon, try context.userLocation
      let lat = args.lat;
      let lon = args.lon;
      let locationName = args.location_name;

      if (lat === undefined && lon === undefined && (context as any).userLocation) {
        const ul = (context as any).userLocation as { lat: number; lon: number; name?: string };
        lat = ul.lat;
        lon = ul.lon;
        locationName = ul.name ?? locationName;
      }

      const result = await getWeather({
        city: args.city,
        lat,
        lon,
        locationName,
      });

      return { ok: true, receipt: result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Weather lookup failed' };
    }
  },
});
