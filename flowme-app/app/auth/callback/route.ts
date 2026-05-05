import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /auth/callback?code=xxx
 * 
 * This is a Route Handler (not a page) that handles the Supabase OAuth PKCE flow.
 * 
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. supabase.auth.signInWithOAuth redirects to Google
 * 3. Google redirects to Supabase: https://xxx.supabase.co/auth/v1/callback
 * 4. Supabase redirects here: http://localhost:3000/auth/callback?code=xxx
 * 5. We exchange the code for a session (sets cookies)
 * 6. We auto-link the primary Google account for calendar access
 * 7. Redirect to /app/calendar
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=no_code`);
  }

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
            // May fail in some contexts, but middleware will handle
          }
        },
      },
    }
  );

  // Exchange the PKCE code for a session — this sets the auth cookies
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('exchangeCodeForSession error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  const session = data.session;
  const user = data.user;

  // Auto-link: create a linked account + store Google tokens
  // so the user's primary Google Calendar works immediately
  if (session.provider_token && user) {
    try {
      const userEmail = user.email || 'My Google Account';

      // Check if user already has a linked account
      const { data: existing } = await supabase
        .from('linked_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .limit(1);

      let accountId: string;

      if (existing && existing.length > 0) {
        accountId = existing[0].id;
      } else {
        // Create the primary linked account
        const { data: newAccount, error: insertError } = await supabase
          .from('linked_accounts')
          .insert({
            user_id: user.id,
            name: userEmail,
            type: 'personal',
            provider: 'google',
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Auto-link insert error:', insertError);
        } else {
          accountId = newAccount.id;
        }
      }

      // Store the Google tokens
      if (accountId!) {
        const { error: tokenError } = await supabase
          .from('user_google_tokens')
          .upsert({
            linked_account_id: accountId,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          }, {
            onConflict: 'linked_account_id',
          });

        if (tokenError) {
          console.error('Auto-link token upsert error:', tokenError);
        }
      }
    } catch (err) {
      // Non-critical — user can manually link later
      console.warn('Auto-link failed (non-critical):', err);
    }
  }

  return NextResponse.redirect(`${appUrl}/app/calendar`);
}
