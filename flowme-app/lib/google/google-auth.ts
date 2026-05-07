import { google } from 'googleapis';
import { getAuthUser } from '../api/auth';
import { ErrorCode } from '../api/errors';

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export interface GoogleTokenAuthContext {
  supabase: any;
  user?: { id: string };
}

export async function getValidGoogleToken(linkedAccountId: string, authContext?: GoogleTokenAuthContext) {
  const auth = authContext || await getAuthUser();
  if (!auth) throw new Error(ErrorCode.UNAUTHORIZED);

  const { supabase } = auth;

  // Fetch token for this linked account
  const { data: tokenRecord, error } = await supabase
    .from('user_google_tokens')
    .select('*')
    .eq('linked_account_id', linkedAccountId)
    .single();

  if (error || !tokenRecord) {
    throw new Error(ErrorCode.GOOGLE_AUTH_MISSING);
  }

  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokenRecord.access_token,
    refresh_token: tokenRecord.refresh_token,
    expiry_date: new Date(tokenRecord.expiry).getTime(),
  });

  // Check if token is expired or expires in < 5 mins
  const isExpired = Date.now() >= new Date(tokenRecord.expiry).getTime() - 5 * 60 * 1000;

  if (isExpired && tokenRecord.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update in DB
      await supabase
        .from('user_google_tokens')
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokenRecord.refresh_token,
          expiry: new Date(credentials.expiry_date!).toISOString(),
        })
        .eq('linked_account_id', linkedAccountId);

      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('Failed to refresh Google token:', err);
      throw new Error(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED);
    }
  } else if (isExpired && !tokenRecord.refresh_token) {
    throw new Error(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED);
  }

  return oauth2Client;
}
