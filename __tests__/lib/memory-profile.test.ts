import {
  UserProfileSchema,
  EMPTY_PROFILE,
  profileIsEmpty,
  renderProfileForPrompt,
  normalizeProfile,
  validateProfileChange,
  type UserProfile,
} from '@/lib/ai/memory/profile';

describe('UserProfileSchema', () => {
  it('parses an empty object into a default profile', () => {
    const parsed = UserProfileSchema.parse({});
    expect(parsed.priorities).toEqual([]);
    expect(parsed.ongoing_work).toEqual([]);
    expect(parsed.important_people).toEqual([]);
    expect(parsed.recent_decisions).toEqual([]);
    expect(parsed.communication_style).toBe('');
  });

  it('rejects priorities with > 10 entries', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `p${i}`);
    expect(() => UserProfileSchema.parse({ priorities: tooMany })).toThrow();
  });

  it('rejects priorities longer than 200 chars', () => {
    expect(() => UserProfileSchema.parse({ priorities: ['a'.repeat(201)] })).toThrow();
  });
});

describe('profileIsEmpty', () => {
  it('returns true for the default profile', () => {
    expect(profileIsEmpty(EMPTY_PROFILE)).toBe(true);
  });

  it('returns false when any array has content', () => {
    const p: UserProfile = { ...EMPTY_PROFILE, priorities: ['ship Tier C'] };
    expect(profileIsEmpty(p)).toBe(false);
  });

  it('returns false when communication_style is set', () => {
    const p: UserProfile = { ...EMPTY_PROFILE, communication_style: 'concise, direct' };
    expect(profileIsEmpty(p)).toBe(false);
  });
});

describe('renderProfileForPrompt', () => {
  it('returns empty string for empty profile', () => {
    expect(renderProfileForPrompt(EMPTY_PROFILE)).toBe('');
  });

  it('renders priorities with bullets', () => {
    const p: UserProfile = { ...EMPTY_PROFILE, priorities: ['ship Tier C', 'fix Gmail auth'] };
    const text = renderProfileForPrompt(p);
    expect(text).toContain('Living user profile');
    expect(text).toContain('- ship Tier C');
    expect(text).toContain('- fix Gmail auth');
  });

  it('renders ongoing_work with status meta', () => {
    const p: UserProfile = {
      ...EMPTY_PROFILE,
      ongoing_work: [{ title: 'Flowme launch', status: 'in progress', since: '2026-04' }],
    };
    const text = renderProfileForPrompt(p);
    expect(text).toContain('Flowme launch (in progress, 2026-04)');
  });

  it('renders important_people with relation', () => {
    const p: UserProfile = {
      ...EMPTY_PROFILE,
      important_people: [{ name: 'Anna', relation: 'partner' }],
    };
    expect(renderProfileForPrompt(p)).toContain('Anna — partner');
  });

  it('renders communication_style on its own line', () => {
    const p: UserProfile = { ...EMPTY_PROFILE, communication_style: 'concise, prefers Portuguese' };
    expect(renderProfileForPrompt(p)).toContain('**Communication style:** concise, prefers Portuguese');
  });
});

describe('validateProfileChange (anti-drift)', () => {
  it('keeps incremental additions intact', () => {
    const prior: UserProfile = { ...EMPTY_PROFILE, priorities: ['a', 'b', 'c'] };
    const next: UserProfile = { ...EMPTY_PROFILE, priorities: ['a', 'b', 'c', 'd'] };
    const safe = validateProfileChange(prior, next);
    expect(safe.priorities).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rejects mass deletion of priorities (drops more than half)', () => {
    const prior: UserProfile = { ...EMPTY_PROFILE, priorities: ['a', 'b', 'c', 'd', 'e'] };
    const next: UserProfile = { ...EMPTY_PROFILE, priorities: ['a'] };
    const safe = validateProfileChange(prior, next);
    expect(safe.priorities).toEqual(prior.priorities);
  });

  it('allows incremental removal (just one) without rejection', () => {
    const prior: UserProfile = { ...EMPTY_PROFILE, priorities: ['a', 'b', 'c'] };
    const next: UserProfile = { ...EMPTY_PROFILE, priorities: ['a', 'b'] };
    const safe = validateProfileChange(prior, next);
    expect(safe.priorities).toEqual(['a', 'b']);
  });

  it('rejects mass deletion of important_people', () => {
    const prior: UserProfile = {
      ...EMPTY_PROFILE,
      important_people: [
        { name: 'Anna' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dan' },
      ],
    };
    const next: UserProfile = { ...EMPTY_PROFILE, important_people: [{ name: 'Anna' }] };
    const safe = validateProfileChange(prior, next);
    expect(safe.important_people).toHaveLength(4);
  });

  it('does not gate small priors (<3 items)', () => {
    const prior: UserProfile = { ...EMPTY_PROFILE, priorities: ['a'] };
    const next: UserProfile = { ...EMPTY_PROFILE, priorities: [] };
    const safe = validateProfileChange(prior, next);
    expect(safe.priorities).toEqual([]);
  });

  it('preserves communication_style if the proposal blanks it', () => {
    const prior: UserProfile = { ...EMPTY_PROFILE, communication_style: 'concise, direct' };
    const next: UserProfile = { ...EMPTY_PROFILE, communication_style: '' };
    const safe = validateProfileChange(prior, next);
    expect(safe.communication_style).toBe('concise, direct');
  });
});

describe('normalizeProfile', () => {
  it('deduplicates and trims noisy profile arrays', () => {
    const profile: UserProfile = {
      ...EMPTY_PROFILE,
      priorities: [' Launch Flowme ', 'launch flowme', 'Ship KG'],
      important_people: [
        { name: ' Anna ', relation: ' partner ' },
        { name: 'anna', relation: 'wife' },
      ],
    };
    const normalized = normalizeProfile(profile);
    expect(normalized.priorities).toEqual(['Launch Flowme', 'Ship KG']);
    expect(normalized.important_people).toEqual([{ name: 'Anna', relation: 'partner' }]);
  });
});
