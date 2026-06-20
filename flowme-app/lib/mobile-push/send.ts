import { createSign } from 'crypto';
import { connect } from 'http2';
import { google } from 'googleapis';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MobilePushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}

export interface MobilePushResult {
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
}

export interface MobilePushAdapter {
  send(token: string, payload: MobilePushPayload): Promise<MobilePushResult>;
}

type MobileToken = {
  id: string;
  provider: 'apns' | 'fcm';
  device_token: string;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function apnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!keyId || !teamId || !privateKey) throw new Error('APNs credentials are not configured');
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signer = createSign('SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${base64Url(signature)}`;
}

export function createApnsAdapter(): MobilePushAdapter {
  return {
    async send(token, payload) {
      const bundleId = process.env.APNS_BUNDLE_ID;
      if (!bundleId) return { ok: false, error: 'APNS_BUNDLE_ID is not configured' };
      const authority = process.env.APNS_USE_SANDBOX === 'true'
        ? 'https://api.sandbox.push.apple.com'
        : 'https://api.push.apple.com';
      try {
        return await new Promise<MobilePushResult>((resolve) => {
          const client = connect(authority);
          const request = client.request({
            ':method': 'POST',
            ':path': `/3/device/${token}`,
            authorization: `bearer ${apnsJwt()}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
          });
          let status = 0;
          let responseBody = '';
          request.setEncoding('utf8');
          request.on('response', headers => { status = Number(headers[':status'] || 0); });
          request.on('data', chunk => { responseBody += chunk; });
          request.on('end', () => {
            client.close();
            const invalidToken = status === 400 || status === 410;
            resolve(status === 200 ? { ok: true } : { ok: false, invalidToken, error: responseBody || `APNs ${status}` });
          });
          request.on('error', error => {
            client.close();
            resolve({ ok: false, error: error.message });
          });
          request.end(JSON.stringify({
            aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
            url: payload.url,
            ...payload.data,
          }));
        });
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'APNs delivery failed' };
      }
    },
  };
}

export function createFcmAdapter(): MobilePushAdapter {
  return {
    async send(token, payload) {
      const projectId = process.env.FCM_PROJECT_ID;
      const clientEmail = process.env.FCM_CLIENT_EMAIL;
      const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!projectId || !clientEmail || !privateKey) return { ok: false, error: 'FCM credentials are not configured' };
      try {
        const auth = new google.auth.GoogleAuth({
          credentials: { client_email: clientEmail, private_key: privateKey },
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
        const accessToken = await auth.getAccessToken();
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data: { ...(payload.data || {}), ...(payload.url ? { url: payload.url } : {}) },
            },
          }),
        });
        if (response.ok) return { ok: true };
        const body = await response.text();
        return {
          ok: false,
          invalidToken: response.status === 404 || body.includes('UNREGISTERED'),
          error: body || `FCM ${response.status}`,
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'FCM delivery failed' };
      }
    },
  };
}

export async function dispatchMobilePush(
  admin: SupabaseClient,
  userId: string,
  payload: MobilePushPayload,
  adapters: { apns: MobilePushAdapter; fcm: MobilePushAdapter } = {
    apns: createApnsAdapter(),
    fcm: createFcmAdapter(),
  },
): Promise<{ attempted: number; delivered: number }> {
  const { data, error } = await admin
    .from('mobile_push_tokens')
    .select('id,provider,device_token')
    .eq('user_id', userId)
    .eq('enabled', true);
  if (error) throw new Error(error.message);
  const tokens = (data || []) as MobileToken[];
  let delivered = 0;
  for (const token of tokens) {
    const result = await adapters[token.provider].send(token.device_token, payload);
    if (result.ok) delivered += 1;
    if (result.invalidToken) {
      await admin.from('mobile_push_tokens').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', token.id);
    }
  }
  return { attempted: tokens.length, delivered };
}
