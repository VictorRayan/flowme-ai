import { weatherAdvice } from '@/lib/briefings/weather-advice';

describe('weatherAdvice', () => {
  it('suggests umbrella and jacket on cold rainy mornings', () => {
    expect(weatherAdvice({
      slot: 'morning',
      temperature_c: 15,
      feels_like_c: 14,
      precipitation_mm: 1.2,
      condition: 'Rain',
    })).toBe('Manhã fria e com chuva: sai de agasalho e guarda-chuva.');
  });

  it('suggests umbrella at night when it is raining', () => {
    expect(weatherAdvice({
      slot: 'evening',
      temperature_c: 22,
      precipitation_mm: 0,
      weather_code: 61,
      condition: 'Rain',
    })).toBe('Se for sair à noite, leva guarda-chuva.');
  });

  it('suggests light clothes and hydration on hot mornings', () => {
    expect(weatherAdvice({
      slot: 'morning',
      temperature_c: 31,
      feels_like_c: 33,
      precipitation_mm: 0,
      condition: 'Clear sky',
    })).toBe('Manhã quente: roupa leve, água e protetor se for ficar na rua.');
  });
});
