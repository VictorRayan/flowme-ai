import { parseChecklistText } from '@/lib/checklists/parser';

describe('parseChecklistText', () => {
  it('extracts grocery items from natural Portuguese text', () => {
    const parsed = parseChecklistText('crie uma checklist de mercado: arroz, feijão, leite e banana');

    expect(parsed.name).toBe('Compra de Mercado');
    expect(parsed.items).toEqual(['arroz', 'feijão', 'leite', 'banana']);
  });

  it('keeps one item per spoken line', () => {
    const parsed = parseChecklistText('Compra de roupa:\ncamiseta branca\ncalça jeans\nmeia');

    expect(parsed.name).toBe('Compra de Roupa');
    expect(parsed.items).toEqual(['camiseta branca', 'calça jeans', 'meia']);
  });

  it('returns an empty draft for blank text', () => {
    expect(parseChecklistText('   ')).toEqual({ name: 'Nova checklist', items: [] });
  });
});
