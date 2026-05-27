import {
  getTutorials,
  getTutorial,
  getTutorialsIntro,
  getTutorialSlugs,
  type TutorialLang,
} from '@/lib/tutorials/content';

const LANGS: TutorialLang[] = ['pt', 'en'];

describe('tutorials-content', () => {
  describe.each(LANGS)('getTutorials(%s)', (lang) => {
    const tutorials = getTutorials(lang);

    it('returns a non-empty catalogue with unique slugs', () => {
      expect(tutorials.length).toBeGreaterThanOrEqual(5);
      const slugs = tutorials.map((t) => t.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('covers the core features referenced by the onboarding tour', () => {
      const slugs = tutorials.map((t) => t.slug);
      expect(slugs).toEqual(expect.arrayContaining(['balys', 'notas', 'daily-briefing', 'conexoes', 'metas', 'calendario']));
    });

    it('gives every tutorial a title, summary and icon', () => {
      for (const t of tutorials) {
        expect(t.title.trim().length).toBeGreaterThan(0);
        expect(t.summary.trim().length).toBeGreaterThan(0);
        expect(t.iconId).toBeTruthy();
        expect(t.readMinutes).toBeGreaterThan(0);
      }
    });

    it('makes every tutorial a step-by-step guide with a real use case', () => {
      for (const t of tutorials) {
        const hasSteps = t.blocks.some((b) => b.kind === 'steps' && b.items.length > 0);
        const hasUseCase = t.blocks.some((b) => b.kind === 'usecase');
        expect(hasSteps).toBe(true);
        expect(hasUseCase).toBe(true);
      }
    });

    it('tells the user where each feature lives by pointing at the menu', () => {
      for (const t of tutorials) {
        const mentionsMenu = t.blocks.some(
          (b) => b.kind === 'steps' && b.items.some((item) => /menu/i.test(item)),
        );
        expect(mentionsMenu).toBe(true);
      }
    });
  });

  describe('getTutorial', () => {
    it('returns a tutorial by slug', () => {
      expect(getTutorial('pt', 'notas')?.title).toContain('Notas');
      expect(getTutorial('en', 'notas')?.title).toContain('Notes');
    });
    it('returns undefined for an unknown slug', () => {
      expect(getTutorial('pt', 'does-not-exist')).toBeUndefined();
    });
  });

  describe('getTutorialSlugs', () => {
    it('matches the slugs of both languages so routes resolve in either language', () => {
      const slugs = getTutorialSlugs();
      expect(getTutorials('pt').map((t) => t.slug).sort()).toEqual([...slugs].sort());
      expect(getTutorials('en').map((t) => t.slug).sort()).toEqual([...slugs].sort());
    });
  });

  describe('getTutorialsIntro', () => {
    it.each(LANGS)('states the productivity/routine/intelligence purpose for %s', (lang) => {
      const intro = getTutorialsIntro(lang);
      expect(intro.title.trim().length).toBeGreaterThan(0);
      expect(intro.subtitle.trim().length).toBeGreaterThan(0);
      const body = intro.body.toLowerCase();
      if (lang === 'pt') {
        expect(body).toMatch(/produtividade/);
        expect(body).toMatch(/rotina/);
        expect(body).toMatch(/intelig/);
      } else {
        expect(body).toMatch(/productivity/);
        expect(body).toMatch(/routine/);
        expect(body).toMatch(/intelligence/);
      }
    });
  });
});
