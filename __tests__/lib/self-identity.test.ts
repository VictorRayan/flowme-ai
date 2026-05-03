import { resolveSelfIdentity } from '@/lib/ai/memory/self';

describe('resolveSelfIdentity', () => {
  it('uses auth metadata name when available', () => {
    expect(resolveSelfIdentity({
      email: 'joao@example.com',
      user_metadata: { full_name: 'Joao Silva' },
    })).toEqual({ name: 'Joao Silva', email: 'joao@example.com' });
  });

  it('falls back to a readable email local part', () => {
    expect(resolveSelfIdentity({
      email: 'maria.souza@example.com',
      user_metadata: {},
    })).toEqual({ name: 'Maria Souza', email: 'maria.souza@example.com' });
  });

  it('never hardcodes Victor or Myself for another SaaS user', () => {
    expect(resolveSelfIdentity({
      email: 'joao@example.com',
      user_metadata: {},
    }).name).toBe('Joao');
  });
});
