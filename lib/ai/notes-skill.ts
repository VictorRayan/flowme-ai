import OpenAI from 'openai';

export type AuthCtx = {
  supabase: any;
  user: { id: string; email?: string | null };
};

export async function buildNotesGraphMap(auth: AuthCtx): Promise<string> {
  const { data: notes, error } = await auth.supabase
    .from('notes')
    .select(`
      id, title, note_date, note_type, content_text, event_title,
      note_mentions(people(name))
    `)
    .eq('user_id', auth.user.id)
    .eq('is_deleted', false)
    .order('note_date', { ascending: false })
    .limit(50); // Hard limit to avoid blowing up context

  if (error || !notes || notes.length === 0) return '';

  const graphLines = notes.map((n: any) => {
    const snippet = n.content_text 
      ? n.content_text.substring(0, 80).replace(/(\r\n|\n|\r)/gm, " ") 
      : 'No text content';
    
    // Graph Edges
    const edges = [];
    if (n.event_title) edges.push(`Event: "${n.event_title}"`);
    if (n.note_mentions && n.note_mentions.length > 0) {
      const names = n.note_mentions.map((m: any) => m.people?.name).filter(Boolean);
      if (names.length > 0) edges.push(`Mentions: [${names.join(', ')}]`);
    }
    const relations = edges.length > 0 ? ` | Relations: ${edges.join(', ')}` : '';

    return `- [Note ID: ${n.id}] Title: "${n.title}" | Date: ${n.note_date}${relations} | Preview: ${snippet}...`;
  });

  return `
--- USER NOTES KNOWLEDGE MAP ---
You (Balys) have access to the user's "Notes Graph Map". This map provides a high-level view of all the user's notes.
You should use this map to understand what information the user has already documented, what is needed to get more details, and what is not needed.

If the user asks a question that can be answered by the Preview snippet, answer directly.
If you need the FULL content of a note to provide a comprehensive answer, refer to the user or note that you need more information.

Available Notes Map:
${graphLines.join('\n')}
--------------------------------
`;
}

type NotesIntent = {
  intent: 'read_note' | 'none';
  note_id: string | null;
};

export async function tryRunNotesSkill(params: {
  auth: AuthCtx;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider: 'openai' | 'gemini';
  model?: string;
  notesMap: string;
}): Promise<{ type: 'inject_context' | 'return_to_user', text: string } | null> {
  const latestMessage = [...params.messages].reverse().find(m => m.role === 'user')?.content || '';
  if (!latestMessage) return null;

  // We only run the skill if there is a hint that they want to read a specific note.
  const lowerMsg = latestMessage.toLowerCase();
  const notesKeywords = ['note', 'notes', 'document', 'write', 'wrote', 'read', 'tell me about', 'what did i say', 'show me'];
  if (!notesKeywords.some(k => lowerMsg.includes(k))) return null;

  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const prompt = `Analyze the user's message and determine if they are asking about the full content of a specific note from their map.
Return EXACTLY THIS JSON FORMAT:
{
  "intent": "read_note" or "none",
  "note_id": "UUID_HERE" or null
}
If they ask a general question that can be answered by the map, set intent to none.
If they explicitly ask about a specific note or its details that require reading the full content, set intent to "read_note" and extract the exact Note ID.
Available Context:
${params.notesMap}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: latestMessage }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as NotesIntent;

    if (parsed.intent === 'read_note' && parsed.note_id) {
      // Fetch the full note content
      const { data: note, error } = await params.auth.supabase
        .from('notes')
        .select('title, content_text, note_date')
        .eq('id', parsed.note_id)
        .single();
      
      if (!error && note) {
        return {
          type: 'inject_context',
          text: `--- FULL CONTENT OF REFERENCED NOTE ---\nTitle: ${note.title}\nDate: ${note.note_date}\n\n${note.content_text}\n---------------------------------------`
        };
      }
    }
  } catch (e) {
    // Silent fail and let the main ai take over
  }

  return null;
}
