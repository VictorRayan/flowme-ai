type BriefingSlot = 'morning' | 'afternoon' | 'evening';

export type WeatherAdviceInput = {
  slot: BriefingSlot;
  temperature_c: number;
  feels_like_c?: number | null;
  precipitation_mm?: number | null;
  weather_code?: number | null;
  condition?: string | null;
};

function isRainy(input: WeatherAdviceInput): boolean {
  const code = input.weather_code;
  const condition = (input.condition || '').toLowerCase();
  return Boolean(
    (typeof input.precipitation_mm === 'number' && input.precipitation_mm > 0)
    || (typeof code === 'number' && ((code >= 51 && code <= 69) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)))
    || /rain|chuva|drizzle|garoa|storm|thunder|tempestade/.test(condition),
  );
}

export function weatherAdvice(input: WeatherAdviceInput): string {
  const feels = typeof input.feels_like_c === 'number' ? input.feels_like_c : input.temperature_c;
  const rainy = isRainy(input);
  const cold = feels <= 17;
  const hot = feels >= 29;

  if (input.slot === 'evening') {
    if (rainy && cold) return 'Se for sair à noite, leva guarda-chuva e um agasalho.';
    if (rainy) return 'Se for sair à noite, leva guarda-chuva.';
    if (cold) return 'Noite fria: vale sair com agasalho.';
    if (hot) return 'Noite quente: roupa leve e água por perto ajudam.';
    return 'Clima tranquilo para a noite.';
  }

  if (input.slot === 'afternoon') {
    if (rainy && cold) return 'Tarde fria e com chuva: leva agasalho e guarda-chuva.';
    if (rainy) return 'Tarde com chuva: tenha um guarda-chuva à mão.';
    if (cold) return 'Tarde fria: um agasalho cai bem.';
    if (hot) return 'Tarde quente: hidrate-se e evite o sol forte.';
    return 'Tarde tranquila lá fora.';
  }

  if (rainy && cold) return 'Manhã fria e com chuva: sai de agasalho e guarda-chuva.';
  if (rainy) return 'Pode chover: leva guarda-chuva antes de sair.';
  if (cold) return 'Manhã fria: coloca um agasalho antes de sair.';
  if (hot) return 'Manhã quente: roupa leve, água e protetor se for ficar na rua.';
  return 'Clima confortável para começar o dia.';
}
