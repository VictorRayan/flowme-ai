import { createHash, sign, verify, X509Certificate } from 'crypto';
import { google } from 'googleapis';
import { computeEntitlementsFromSubscription, type BillingProvider, type SubscriptionStatus } from './entitlements';

export type VerifiedMobileSubscription = {
  provider: Extract<BillingProvider, 'apple' | 'google'>;
  providerSubscriptionId: string;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
  productId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  userBinding: string | null;
  metadata: Record<string, unknown>;
};

function decodeBase64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function verifyAndDecodeAppleJws(signedPayload: string): Record<string, unknown> {
  const parts = signedPayload.split('.');
  if (parts.length !== 3) throw new Error('Invalid Apple signed payload');
  const header = decodeBase64UrlJson(parts[0]);
  const certificates = Array.isArray(header.x5c) ? header.x5c.filter((item): item is string => typeof item === 'string') : [];
  if (header.alg !== 'ES256' || certificates.length === 0) throw new Error('Apple signed payload certificate missing');
  const rootCertificateBase64 = process.env.APPLE_ROOT_CA_BASE64;
  if (!rootCertificateBase64) throw new Error('APPLE_ROOT_CA_BASE64 is not configured');
  const chain = certificates.map(value => new X509Certificate(Buffer.from(value, 'base64')));
  const rootCertificate = new X509Certificate(Buffer.from(rootCertificateBase64, 'base64'));
  const now = Date.now();
  for (const certificate of [...chain, rootCertificate]) {
    if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) < now) throw new Error('Apple signing certificate expired');
  }
  for (let index = 0; index < chain.length - 1; index++) {
    if (!chain[index].verify(chain[index + 1].publicKey)) throw new Error('Invalid Apple certificate chain');
  }
  if (!chain[chain.length - 1].verify(rootCertificate.publicKey)) throw new Error('Apple certificate chain is not trusted');
  const certificate = chain[0];
  const verified = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), {
    key: certificate.publicKey,
    dsaEncoding: 'ieee-p1363',
  }, Buffer.from(parts[2], 'base64url'));
  if (!verified) throw new Error('Invalid Apple signed payload signature');
  return decodeBase64UrlJson(parts[1]);
}

function isoFromMillis(value: unknown): string | null {
  const millis = Number(value);
  return Number.isFinite(millis) && millis > 0 ? new Date(millis).toISOString() : null;
}

function configuredProductIds(provider: 'apple' | 'google'): string[] {
  const prefix = provider === 'apple' ? 'APPLE' : 'GOOGLE_PLAY';
  return [process.env[`${prefix}_PRO_MONTHLY_PRODUCT_ID`], process.env[`${prefix}_PRO_ANNUAL_PRODUCT_ID`]]
    .filter((value): value is string => Boolean(value));
}

function assertProduct(provider: 'apple' | 'google', productId: string) {
  const configured = configuredProductIds(provider);
  if (configured.length === 0 || !configured.includes(productId)) throw new Error(`Unrecognized ${provider} subscription product`);
}

export function verifyAppleSubscription(signedTransaction: string, expectedUserId: string): VerifiedMobileSubscription {
  const payload = verifyAndDecodeAppleJws(signedTransaction);
  const productId = String(payload.productId || '');
  const bundleId = String(payload.bundleId || '');
  if (process.env.APPLE_BUNDLE_ID && bundleId !== process.env.APPLE_BUNDLE_ID) throw new Error('Apple bundle id mismatch');
  assertProduct('apple', productId);
  const userBinding = typeof payload.appAccountToken === 'string' ? payload.appAccountToken : null;
  if (userBinding !== expectedUserId) throw new Error('Apple purchase is not linked to this user');
  const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId : '';
  const originalTransactionId = typeof payload.originalTransactionId === 'string' ? payload.originalTransactionId : '';
  if (!transactionId || !originalTransactionId) throw new Error('Apple transaction identifiers are missing');
  const periodEnd = isoFromMillis(payload.expiresDate);
  const revoked = Boolean(payload.revocationDate);
  const active = !revoked && Boolean(periodEnd && Date.parse(periodEnd) > Date.now());
  return {
    provider: 'apple',
    providerSubscriptionId: transactionId,
    originalTransactionId,
    productId,
    status: active ? 'active' : 'expired',
    currentPeriodStart: isoFromMillis(payload.purchaseDate),
    currentPeriodEnd: periodEnd,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    userBinding,
    metadata: { environment: payload.environment, bundle_id: bundleId },
  };
}

function appleServerApiToken(): string {
  const issuer = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    || (process.env.APPLE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.APPLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
      : undefined);
  if (!issuer || !keyId || !bundleId || !privateKey) throw new Error('Apple Server API credentials are not configured');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: bundleId })).toString('base64url');
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

export async function fetchAppleSubscription(transactionId: string, expectedUserId: string, environment: 'Sandbox' | 'Production' = 'Production') {
  const host = environment === 'Sandbox' ? 'https://api.storekit-sandbox.apple.com' : 'https://api.storekit.apple.com';
  const response = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${appleServerApiToken()}` },
  });
  if (!response.ok) throw new Error(`Apple Server API ${response.status}`);
  const body = await response.json() as {
    data?: Array<{ lastTransactions?: Array<{ status?: number; signedTransactionInfo?: string; signedRenewalInfo?: string }> }>;
  };
  const lastTransaction = body.data?.flatMap(group => group.lastTransactions || [])[0];
  if (typeof lastTransaction?.signedTransactionInfo !== 'string') throw new Error('Apple subscription response is missing signedTransactionInfo');
  const verified = verifyAppleSubscription(lastTransaction.signedTransactionInfo, expectedUserId);
  const renewal = typeof lastTransaction.signedRenewalInfo === 'string'
    ? verifyAndDecodeAppleJws(lastTransaction.signedRenewalInfo)
    : {};
  const statusByCode: Record<number, SubscriptionStatus> = {
    1: 'active', 2: 'expired', 3: 'past_due', 4: 'grace_period', 5: 'canceled',
  };
  const status = statusByCode[lastTransaction.status || 0] || verified.status;
  return {
    ...verified,
    status,
    gracePeriodEndsAt: status === 'grace_period' ? isoFromMillis(renewal.gracePeriodExpiresDate) || verified.currentPeriodEnd : null,
    cancelAtPeriodEnd: renewal.autoRenewStatus === 0,
    metadata: { ...verified.metadata, renewal_status: lastTransaction.status || null },
  };
}

export function applyAppleNotificationState(
  verified: VerifiedMobileSubscription,
  notificationType: string,
  subtype?: string,
): VerifiedMobileSubscription {
  if (notificationType === 'DID_RENEW' || notificationType === 'SUBSCRIBED') return { ...verified, status: 'active' };
  if (notificationType === 'DID_FAIL_TO_RENEW') {
    return { ...verified, status: subtype === 'GRACE_PERIOD' ? 'grace_period' : 'past_due' };
  }
  if (notificationType === 'GRACE_PERIOD_EXPIRED' || notificationType === 'EXPIRED') return { ...verified, status: 'expired' };
  if (notificationType === 'REFUND' || notificationType === 'REVOKE') return { ...verified, status: 'canceled' };
  return verified;
}

export function googleObfuscatedAccountId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

function mapGoogleState(state: string): SubscriptionStatus {
  if (state === 'SUBSCRIPTION_STATE_ACTIVE') return 'active';
  if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return 'grace_period';
  if (state === 'SUBSCRIPTION_STATE_ON_HOLD' || state === 'SUBSCRIPTION_STATE_PAUSED') return 'account_hold';
  if (state === 'SUBSCRIPTION_STATE_CANCELED') return 'canceled';
  if (state === 'SUBSCRIPTION_STATE_PENDING') return 'incomplete';
  return 'expired';
}

export async function fetchGoogleSubscription(purchaseToken: string, expectedUserId?: string): Promise<VerifiedMobileSubscription> {
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) throw new Error('GOOGLE_PLAY_PACKAGE_NAME is not configured');
  const encodedCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64;
  const rawCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
    || (encodedCredentials ? Buffer.from(encodedCredentials, 'base64').toString('utf8') : undefined);
  const credentials = rawCredentials ? JSON.parse(rawCredentials) : undefined;
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const publisher = google.androidpublisher({ version: 'v3', auth });
  const { data } = await publisher.purchases.subscriptionsv2.get({ packageName, token: purchaseToken });
  const lineItem = data.lineItems?.[0];
  const productId = lineItem?.productId || '';
  assertProduct('google', productId);
  const userBinding = data.externalAccountIdentifiers?.obfuscatedExternalAccountId || null;
  if (expectedUserId && userBinding !== googleObfuscatedAccountId(expectedUserId)) throw new Error('Google Play purchase is not linked to this user');
  const status = mapGoogleState(data.subscriptionState || '');
  const periodEnd = lineItem?.expiryTime || null;
  return {
    provider: 'google',
    providerSubscriptionId: data.latestOrderId || purchaseToken,
    purchaseToken,
    productId,
    status,
    currentPeriodStart: data.startTime || null,
    currentPeriodEnd: periodEnd,
    gracePeriodEndsAt: status === 'grace_period' ? periodEnd : null,
    cancelAtPeriodEnd: status === 'canceled' || lineItem?.autoRenewingPlan?.autoRenewEnabled === false,
    userBinding,
    metadata: { package_name: packageName, acknowledgement_state: data.acknowledgementState, test_purchase: Boolean(data.testPurchase) },
  };
}

export async function syncVerifiedMobileSubscription(admin: any, userId: string, verified: VerifiedMobileSubscription) {
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    plan_code: 'pro',
    billing_provider: verified.provider,
    provider_subscription_id: verified.providerSubscriptionId,
    provider_original_transaction_id: verified.originalTransactionId || null,
    provider_purchase_token: verified.purchaseToken || null,
    status: verified.status,
    current_period_start: verified.currentPeriodStart,
    current_period_end: verified.currentPeriodEnd,
    cancel_at_period_end: verified.cancelAtPeriodEnd,
    grace_period_ends_at: verified.gracePeriodEndsAt,
    last_synced_at: now,
    metadata: { ...verified.metadata, product_id: verified.productId, user_binding: verified.userBinding },
    updated_at: now,
  };
  const conflict = verified.provider === 'apple'
    ? 'billing_provider,provider_original_transaction_id'
    : 'billing_provider,provider_purchase_token';
  const { error } = await admin.from('user_subscriptions').upsert(row, { onConflict: conflict });
  if (error) throw new Error(error.message);
  const entitlements = computeEntitlementsFromSubscription(userId, row);
  const { error: entitlementError } = await admin.from('user_entitlements').upsert({
    user_id: userId, plan_code: entitlements.plan_code, has_pro: entitlements.has_pro,
    billing_state: entitlements.billing_state, access_until: entitlements.access_until,
    features: entitlements.features, ai_credits: entitlements.ai_credits, updated_at: now,
  }, { onConflict: 'user_id' });
  if (entitlementError) throw new Error(entitlementError.message);
  return { subscription: row, entitlements };
}
