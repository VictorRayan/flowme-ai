import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/v1/notes/route';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';

jest.mock('@/lib/api/api-key-auth', () => ({ requireApiKeyAuth: jest.fn() }));

const USER_ID = 'user-a';
const OWN_PERSON = '11111111-1111-4111-8111-111111111111';
const FOREIGN_PERSON = '22222222-2222-4222-8222-222222222222';

function chain(data: unknown, singleData: unknown = data) {
  const query: Record<string, jest.Mock | ((resolve: (value: unknown) => void) => Promise<void>)> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'range', 'gte', 'lte', 'ilike', 'insert']) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  query.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  query.then = (resolve: (value: unknown) => void) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
}

describe('v1 notes tenant isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a foreign mention before creating a note', async () => {
    const people = chain([]);
    const notes = chain([], { id: 'note-a' });
    const supabase = { from: jest.fn((table: string) => table === 'people' ? people : notes) };
    (requireApiKeyAuth as jest.Mock).mockResolvedValue({ userId: USER_ID, supabase });

    const response = await POST(new NextRequest('http://localhost/api/v1/notes', {
      method: 'POST', body: JSON.stringify({ content_text: 'hello', mention_ids: [FOREIGN_PERSON] }),
    }));

    expect(response.status).toBe(400);
    expect(people.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(supabase.from).not.toHaveBeenCalledWith('notes');
  });

  it('omits foreign people from existing note mentions', async () => {
    const notes = chain([{ id: 'note-a', title: 'Mine' }]);
    const mentions = chain([
      { note_id: 'note-a', person_id: OWN_PERSON },
      { note_id: 'note-a', person_id: FOREIGN_PERSON },
    ]);
    const people = chain([{ id: OWN_PERSON, name: 'Owned', email: 'owned@example.com' }]);
    const supabase = { from: jest.fn((table: string) => ({ notes, note_mentions: mentions, people })[table as 'notes' | 'note_mentions' | 'people']) };
    (requireApiKeyAuth as jest.Mock).mockResolvedValue({ userId: USER_ID, supabase });

    const response = await GET(new NextRequest('http://localhost/api/v1/notes'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(people.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(body.notes[0].note_mentions).toEqual([{ person_id: OWN_PERSON, people: { id: OWN_PERSON, name: 'Owned', email: 'owned@example.com' } }]);
  });
});
