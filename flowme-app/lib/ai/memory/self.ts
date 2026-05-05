export type SelfIdentity = {
  name: string;
  email?: string | null;
};

type AuthUserLike = {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
};

const FALLBACK_SELF_NAME = 'Me';

export function resolveSelfIdentity(user: AuthUserLike): SelfIdentity {
  const metadata = user.user_metadata || {};
  const identityData = user.identities?.map((identity) => identity.identity_data || {}) || [];
  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
    metadata.user_name,
    metadata.preferred_username,
    ...identityData.flatMap((data) => [
      data.full_name,
      data.name,
      data.display_name,
      data.user_name,
      data.preferred_username,
    ]),
  ];

  const metadataName = candidates.map(cleanName).find(Boolean);
  const emailName = nameFromEmail(user.email);
  return {
    name: metadataName || emailName || FALLBACK_SELF_NAME,
    email: user.email || null,
  };
}

export async function ensureSelfPerson(
  supabase: any,
  userId: string,
  self: SelfIdentity,
): Promise<{ ok: boolean; person?: { id: string; name: string; email?: string | null; person_note_id?: string | null }; error?: string }> {
  const name = cleanName(self.name) || FALLBACK_SELF_NAME;
  const email = self.email || null;

  if (email) {
    const { data: byEmail, error: emailError } = await supabase
      .from('people')
      .select('id, name, email, person_note_id')
      .eq('user_id', userId)
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    if (emailError) return { ok: false, error: emailError.message };
    if (byEmail) {
      if (byEmail.name !== name) {
        await supabase.from('people').update({ name }).eq('id', byEmail.id).eq('user_id', userId);
      }
      return { ok: true, person: { ...byEmail, name } };
    }
  }

  const { data: byName, error: nameError } = await supabase
    .from('people')
    .select('id, name, email, person_note_id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (nameError) return { ok: false, error: nameError.message };
  if (byName) {
    if (email && !byName.email) {
      await supabase.from('people').update({ email }).eq('id', byName.id).eq('user_id', userId);
    }
    return { ok: true, person: { ...byName, email: byName.email || email } };
  }

  const { data: legacySelf, error: legacyError } = await supabase
    .from('people')
    .select('id, name, email, person_note_id')
    .eq('user_id', userId)
    .in('name', ['Myself', 'myself', 'Me', 'me'])
    .is('email', null)
    .limit(1)
    .maybeSingle();
  if (legacyError) return { ok: false, error: legacyError.message };
  if (legacySelf) {
    const { data: renamed, error: renameError } = await supabase
      .from('people')
      .update({ name, email })
      .eq('id', legacySelf.id)
      .eq('user_id', userId)
      .select('id, name, email, person_note_id')
      .single();
    if (!renameError && renamed) return { ok: true, person: renamed };
  }

  const { data: created, error: createError } = await supabase
    .from('people')
    .insert({ user_id: userId, name, email })
    .select('id, name, email, person_note_id')
    .single();
  if (createError || !created) return { ok: false, error: createError?.message || 'Failed to create self person' };
  return { ok: true, person: created };
}

export async function cleanupBadGeneratedPeople(
  supabase: any,
  userId: string,
): Promise<{ deleted: number; names: string[] }> {
  const badNames = ['Flow', 'flow', 'Cowork'];
  const { data: candidates } = await supabase
    .from('people')
    .select('id, name, email')
    .eq('user_id', userId)
    .in('name', badNames)
    .is('email', null);

  const ids = (candidates || []).map((person: { id: string }) => person.id);
  if (!ids.length) return { deleted: 0, names: [] };

  await supabase.from('notes').update({ is_deleted: true }).eq('user_id', userId).in('event_id', ids.map((id: string) => `person:${id}`));
  await supabase.from('people').delete().eq('user_id', userId).in('id', ids);

  return {
    deleted: ids.length,
    names: (candidates || []).map((person: { name: string }) => person.name),
  };
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function nameFromEmail(email?: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] || '';
  const spaced = local
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced.split(' ').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}
