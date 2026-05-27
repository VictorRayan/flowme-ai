import {
  getTourSections,
  getTourLabels,
  reviewSectionIndex,
  canSkipSection,
  clampSectionIndex,
  type TourLang,
} from '@/lib/onboarding/tour-content';

const LANGS: TourLang[] = ['pt', 'en'];

describe('tour-content', () => {
  describe.each(LANGS)('getTourSections(%s)', (lang) => {
    const sections = getTourSections(lang);

    it('returns the four sections in order: balys, connections, notes, review', () => {
      expect(sections.map((s) => s.id)).toEqual(['balys', 'connections', 'notes', 'review']);
    });

    it('has exactly one mandatory section and it is the last (review)', () => {
      const mandatory = sections.filter((s) => s.mandatory);
      expect(mandatory).toHaveLength(1);
      expect(mandatory[0].id).toBe('review');
      expect(sections[sections.length - 1].id).toBe('review');
    });

    it('gives every section a non-empty overline, title and intro', () => {
      for (const s of sections) {
        expect(s.overline.trim().length).toBeGreaterThan(0);
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.intro.trim().length).toBeGreaterThan(0);
      }
    });

    it('lists concrete Balys capabilities with real examples', () => {
      const balys = sections.find((s) => s.id === 'balys')!;
      expect(balys.features.length).toBeGreaterThanOrEqual(4);
      for (const f of balys.features) {
        expect(f.title.trim().length).toBeGreaterThan(0);
        expect(f.example.trim().length).toBeGreaterThan(0);
      }
      // audio + image are explained as bullets
      const bullets = balys.bullets.join(' ').toLowerCase();
      expect(bullets).toMatch(/microf|microph/);
      expect(bullets).toMatch(/imag/);
      // council is mentioned in the tip
      expect((balys.tip || '').toLowerCase()).toMatch(/conselho|council/);
    });

    it('names the real connectors (Gmail, Docs, Sheets, Drive)', () => {
      const conn = sections.find((s) => s.id === 'connections')!;
      const text = conn.bullets.join(' ');
      expect(text).toMatch(/Gmail/);
      expect(text).toMatch(/Google Docs/);
      expect(text).toMatch(/Google Sheets/);
      expect(text).toMatch(/Google Drive/);
    });

    it('explains audio notes and the daily briefing in the notes section', () => {
      const notes = sections.find((s) => s.id === 'notes')!;
      const text = notes.bullets.join(' ').toLowerCase();
      expect(text).toMatch(/microf|microph/);
      expect(text).toMatch(/briefing/);
      // import-from-ChatGPT/Claude tip
      expect((notes.tip || '')).toMatch(/ChatGPT|Claude/);
    });

    it('points the user to the Tutorials section in the mandatory step', () => {
      const review = sections.find((s) => s.id === 'review')!;
      expect(review.intro).toMatch(/Tutoriais|Tutorials/);
      expect(review.mandatory).toBe(true);
    });
  });

  describe('reviewSectionIndex', () => {
    it('returns the index of the mandatory review section', () => {
      expect(reviewSectionIndex(getTourSections('pt'))).toBe(3);
      expect(reviewSectionIndex(getTourSections('en'))).toBe(3);
    });
  });

  describe('canSkipSection', () => {
    const sections = getTourSections('pt');
    it('allows skipping the explanatory sections', () => {
      expect(canSkipSection(sections, 0)).toBe(true);
      expect(canSkipSection(sections, 1)).toBe(true);
      expect(canSkipSection(sections, 2)).toBe(true);
    });
    it('forbids skipping the mandatory review section', () => {
      expect(canSkipSection(sections, 3)).toBe(false);
    });
    it('returns false for an out-of-range index', () => {
      expect(canSkipSection(sections, 99)).toBe(false);
    });
  });

  describe('clampSectionIndex', () => {
    it('keeps the index within [0, total - 1]', () => {
      expect(clampSectionIndex(-3, 4)).toBe(0);
      expect(clampSectionIndex(2, 4)).toBe(2);
      expect(clampSectionIndex(9, 4)).toBe(3);
    });
  });

  describe('getTourLabels', () => {
    it.each(LANGS)('returns navigation labels and a progress formatter for %s', (lang) => {
      const labels = getTourLabels(lang);
      expect(labels.back.length).toBeGreaterThan(0);
      expect(labels.next.length).toBeGreaterThan(0);
      expect(labels.skip.length).toBeGreaterThan(0);
      expect(labels.finish.length).toBeGreaterThan(0);
      expect(labels.progress(1, 4)).toContain('4');
    });
  });
});
