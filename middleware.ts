import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a response we can modify (to set updated cookies)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase client that reads/writes cookies on the request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Set cookies on the response (for the browser)
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // This refreshes the session if expired and sets updated cookies
  let user = null;
  let authError = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch {
    // Network error (e.g. Supabase unreachable) — fail open to avoid logout loop
    authError = { message: 'network_error' };
  }

  const isNetworkError = authError?.message === 'network_error' ||
    authError?.message?.includes('fetch') ||
    authError?.message?.includes('network');

  // Protect /app routes — redirect to login if no user (but not on network errors)
  if (pathname.startsWith('/app') && !user && !isNetworkError) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is logged in and visits login page, redirect to app
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const appUrl = new URL('/app/calendar', request.url);
    return NextResponse.redirect(appUrl);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/login', '/signup'],
};
