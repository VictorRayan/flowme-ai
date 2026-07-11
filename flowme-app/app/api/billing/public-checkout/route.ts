import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { appBaseUrl, normalizeBillingInterval } from '@/lib/billing/stripe-adapter';
import { normalizeCatalogLocale } from '@/lib/billing/catalog';
import { checkoutCardErrorMessage, checkoutPixAllowedForInterval, checkoutPixAnnualOnlyMessage } from '@/lib/billing/checkout-ui';
import { resolveRequestCountry } from '@/lib/billing/ip-country';
import { GatewayCheckoutError } from '@/lib/billing/providers/contracts';
import { getBillingGateway } from '@/lib/billing/providers/registry';
import type { WebBillingProvider, WebPaymentMethod } from '@/lib/billing/providers/contracts';
import { createSignedMarketingToken, verifySignedMarketingToken } from '@/lib/marketing/signed-token';

const PAYMENT_METHODS: WebPaymentMethod[] = ['pix', 'card', 'apple_pay', 'google_pay'];

function paymentMethod(value: unknown): WebPaymentMethod | null {
  return PAYMENT_METHODS.includes(value as WebPaymentMethod) ? value as WebPaymentMethod : null;
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const leadToken = text(body.lead_token, 2000);
  const tokenPayload = verifySignedMarketingToken(leadToken, 'lead');
  if (!tokenPayload) return apiError(ErrorCode.UNAUTHORIZED, 'Lead token is invalid or expired', 401);

  const interval = normalizeBillingInterval(body.interval || 'annual');
  const method = paymentMethod(body.payment_method || 'card');
  const planCode = text(body.plan_code, 80) || 'pro';
  const locale = normalizeCatalogLocale(body.locale);
  if (!interval) return apiError(ErrorCode.VALIDATION_ERROR, 'interval must be monthly or annual', 400);
  if (!method) return apiError(ErrorCode.VALIDATION_ERROR, 'payment_method is invalid', 400);
  if (method === 'pix' && !checkoutPixAllowedForInterval(interval)) {
    return apiError(ErrorCode.VALIDATION_ERROR, checkoutPixAnnualOnlyMessage(locale), 400);
  }

  const providerPaymentMethodId = text(body.payment_method_id, 200);
  if (method !== 'pix' && !/^pm_[A-Za-z0-9_]+$/.test(providerPaymentMethodId)) {
    return apiError(ErrorCode.VALIDATION_ERROR, locale === 'en-US' ? 'Card token is invalid' : 'Token do cartão inválido', 400);
  }
  if (method === 'pix' && await resolveRequestCountry(req.headers) !== 'BR') {
    return apiError(ErrorCode.VALIDATION_ERROR, locale === 'en-US' ? 'Pix is available only in Brazil' : 'Pix está disponível apenas no Brasil', 400);
  }
  if (method === 'pix' && (!text(body.customer_name, 160) || !text(body.cpf_cnpj, 40))) {
    return apiError(ErrorCode.VALIDATION_ERROR, 'customer_name and cpf_cnpj are required for Pix', 400);
  }

  const admin = getSupabaseAdmin();
  const { data: lead, error: leadError } = await admin.from('marketing_leads')
    .select('id,email,name,phone,phone_e164,locale,source,meta_external_id,visitor_id')
    .eq('id', tokenPayload.id)
    .maybeSingle();
  if (leadError) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to load lead', 500);
  if (!lead || String(lead.email).trim().toLowerCase() !== tokenPayload.email) {
    return apiError(ErrorCode.UNAUTHORIZED, 'Lead token does not match checkout email', 401);
  }

  const { data: route, error: routeError } = await admin.from('billing_payment_method_routes')
    .select('provider,currency')
    .eq('payment_method', method)
    .eq('enabled', true)
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (routeError || !route) return apiError(ErrorCode.NOT_FOUND, 'Payment method is not available', 404);
  const provider = route.provider as WebBillingProvider;

  const [{ data: price, error: priceError }, { data: localization, error: localizationError }] = await Promise.all([
    admin.from('subscription_prices')
      .select('id,provider_price_id,currency,amount_cents')
      .eq('plan_code', planCode)
      .eq('billing_provider', provider)
      .eq('billing_interval', interval)
      .eq('currency', route.currency)
      .eq('active', true)
      .limit(1)
      .maybeSingle(),
    admin.from('subscription_plan_localizations')
      .select('name,description')
      .eq('plan_code', planCode)
      .eq('locale', locale)
      .maybeSingle(),
  ]);
  if (priceError || !price?.provider_price_id) return apiError(ErrorCode.NOT_FOUND, 'Plan price is not available', 404);
  if (localizationError || !localization) return apiError(ErrorCode.NOT_FOUND, 'Plan description is not available', 404);

  const { data: previousSession } = await admin.from('public_checkout_sessions')
    .select('provider_customer_id')
    .eq('email', tokenPayload.email)
    .eq('provider', provider)
    .not('provider_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const checkoutSource = text(body.source, 120) || text(lead.source, 120);
  const customerName = method === 'pix' ? text(body.customer_name, 160) : text(lead.name, 160) || tokenPayload.email.split('@')[0];
  const metaExternalId = text(body.meta_external_id, 120) || text(lead.meta_external_id, 120) || text(lead.visitor_id, 120);
  const metaFbp = text(body.meta_fbp, 200);
  const metaFbc = text(body.meta_fbc, 200);
  const { data: session, error: sessionError } = await admin.from('public_checkout_sessions').insert({
    lead_id: lead.id,
    meta_external_id: metaExternalId,
    email: tokenPayload.email,
    customer_name: customerName,
    phone: text(lead.phone, 40),
    phone_e164: text(lead.phone_e164, 40),
    plan_code: planCode,
    price_id: price.id,
    provider,
    payment_method: method,
    billing_interval: interval,
    locale,
    currency: price.currency,
    amount_cents: price.amount_cents,
    status: 'created',
    source: checkoutSource,
    metadata: {
      source: checkoutSource,
      public_checkout: true,
      ...(metaFbp ? { meta_fbp: metaFbp } : {}),
      ...(metaFbc ? { meta_fbc: metaFbc } : {}),
    },
  }).select('id').single();
  if (sessionError || !session) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to initialize public checkout', 500);

  try {
    const gateway = getBillingGateway(provider);
    const result = await gateway.createCheckout({
      attemptId: session.id,
      userId: null,
      publicCheckoutSessionId: session.id,
      userEmail: tokenPayload.email,
      customerName,
      customerTaxId: method === 'pix' ? text(body.cpf_cnpj, 40) : null,
      existingCustomerId: previousSession?.provider_customer_id || null,
      planCode,
      localizedName: localization.name,
      localizedDescription: localization.description,
      locale,
      interval,
      paymentMethod: method,
      currency: price.currency,
      amountCents: price.amount_cents,
      providerPriceId: price.provider_price_id,
      providerPaymentMethodId: method === 'pix' ? null : providerPaymentMethodId,
      returnUrl: `${appBaseUrl(req.url)}/checkout/return`,
    });
    const { error: updateError } = await admin.from('public_checkout_sessions').update({
      status: 'awaiting_payment',
      provider_customer_id: result.providerCustomerId,
      provider_checkout_id: result.providerCheckoutId,
      provider_subscription_id: result.providerSubscriptionId,
      provider_payment_id: result.providerPaymentId,
      expires_at: result.expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    if (updateError) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to save public checkout state', 500);

    return apiSuccess({
      attempt_id: session.id,
      public_checkout_token: createSignedMarketingToken({ kind: 'public_checkout', id: session.id, email: tokenPayload.email }),
      email: tokenPayload.email,
      checkout: result,
    });
  } catch (gatewayError) {
    const providerErrorMessage = gatewayError instanceof Error ? gatewayError.message : 'unknown checkout error';
    const providerErrorCode = gatewayError instanceof GatewayCheckoutError ? gatewayError.code : null;
    await admin.from('public_checkout_sessions').update({
      status: 'failed',
      metadata: {
        source: checkoutSource,
        public_checkout: true,
        provider_error_message: providerErrorMessage,
        provider_error_code: providerErrorCode,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    if (gatewayError instanceof GatewayCheckoutError) {
      return apiError(ErrorCode.PAYMENT_PROVIDER_ERROR, checkoutCardErrorMessage(gatewayError.code, locale), 402);
    }
    const invalidDocument = gatewayError instanceof Error && gatewayError.message === 'invalid CPF/CNPJ';
    return apiError(
      invalidDocument ? ErrorCode.VALIDATION_ERROR : ErrorCode.PAYMENT_PROVIDER_ERROR,
      invalidDocument ? 'CPF/CNPJ inválido' : 'Não foi possível iniciar o pagamento',
      invalidDocument ? 400 : 502,
    );
  }
}
