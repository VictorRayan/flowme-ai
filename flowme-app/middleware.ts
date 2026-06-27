import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { featureForApiPath, featureForAppPath } from '@/lib/billing/feature-routes';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // V1 API routes use their own Bearer token auth — skip cookie middleware
  if (pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

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

  // Protect authenticated app and standalone checkout routes.
  if ((pathname.startsWith('/app') || pathname === '/checkout') && !user && !isNetworkError) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is logged in and visits login page, redirect to app
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const appUrl = new URL('/app/calendar', request.url);
    return NextResponse.redirect(appUrl);
  }

  const requiredFeature = featureForApiPath(pathname) || featureForAppPath(pathname);
  if (user && requiredFeature) {
    try {
      const entitlements = await getUserEntitlements(supabase, user.id);
      if (!isFeatureAllowed(entitlements, requiredFeature)) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({
            ok: false,
            error: { code: 'FEATURE_LOCKED', message: 'This feature requires Flow Me Pro' },
            required_plan: 'pro',
            feature_key: requiredFeature,
            checkout_available: true,
          }, { status: 402 });
        }
        const upgradeUrl = new URL('/app/settings', request.url);
        upgradeUrl.searchParams.set('upgrade', requiredFeature);
        return NextResponse.redirect(upgradeUrl);
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to verify feature access' },
        }, { status: 500 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/app/:path*',
    '/checkout',
    '/login',
    '/signup',
    '/api/v1/:path*',
    '/api/calendar/:path*',
    '/api/events/:path*',
    '/api/tasks/:path*',
    '/api/action-plans/:path*',
    '/api/goals/:path*',
    '/api/finance/:path*',
    '/api/connectors/:path*',
    '/api/weekly-reviews/:path*',
    '/api/monthly-reviews/:path*',
    '/api/briefings/:path*',
    '/api/reminders/:path*',
    '/api/meetings/:path*',
    '/api/ai/images/:path*',
    '/api/whatsapp/channel/:path*',
  ],
};
