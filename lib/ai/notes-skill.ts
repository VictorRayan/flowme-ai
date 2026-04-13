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
If you need the FULL content of a note to provide a comprehensive answer, you can explicitly ask the user to fetch it (e.g., "Could you share the full contents of the note titled 'X' (ID: Y)?").

Available Notes Map:
${graphLines.join('\n')}
--------------------------------
`;
}
