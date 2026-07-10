import { formatGoogleCityPrediction, formatNominatimCity } from '@/lib/location/cities';

describe('city location formatting', () => {
  it('formats Google city terms as city, state — country', () => {
    expect(formatGoogleCityPrediction({
      place_id: 'google-place',
      description: 'São Paulo, State of São Paulo, Brazil',
      terms: [{ value: 'São Paulo' }, { value: 'São Paulo' }, { value: 'Brasil' }],
    })).toEqual({
      label: 'São Paulo, São Paulo — Brasil',
      description: 'São Paulo, São Paulo — Brasil',
      place_id: 'google-place',
    });
  });

  it('formats Nominatim cities with coordinates for timezone resolution', () => {
    expect(formatNominatimCity({
      place_id: 123,
      lat: '-23.5506507',
      lon: '-46.6333824',
      address: { city: 'São Paulo', state: 'São Paulo', country: 'Brasil' },
    })).toEqual({
      label: 'São Paulo, São Paulo — Brasil',
      description: 'São Paulo, São Paulo — Brasil',
      place_id: '123',
      latitude: -23.5506507,
      longitude: -46.6333824,
    });
  });

  it('rejects results without a city or valid coordinates', () => {
    expect(formatNominatimCity({ place_id: 1, lat: 'x', lon: '1', address: { country: 'Brasil' } })).toBeNull();
  });
});
