import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ErrorCode } from './errors';

export async function getAuthUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in Server Components (read-only).
            // This is fine — the middleware already handles refresh.
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { user, supabase };
}

export async function requireAuth() {
  const auth = await getAuthUser();
  if (!auth) {
    throw new Error('UNAUTHORIZED');
  }
  return auth;
}
