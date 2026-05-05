import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function getAuthUser(request?: NextRequest) {
  let supabase;

  if (request) {
    // Route handler path — use request/response cookies for proper token refresh
    const response = NextResponse.next({ request: { headers: request.headers } });
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );
  } else {
    // Server Component / action path — use next/headers cookies
    const cookieStore = await cookies();
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch {
              // Read-only in Server Components — middleware handles refresh
            }
          },
        },
      }
    );
  }

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { user, supabase };
}

export async function requireAuth(request?: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth) {
    throw new Error('UNAUTHORIZED');
  }
  return auth;
}
