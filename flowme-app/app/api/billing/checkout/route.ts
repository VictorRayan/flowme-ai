import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { appBaseUrl, normalizeBillingInterval } from '@/lib/billing/stripe-adapter';
import { normalizeCatalogLocale } from '@/lib/billing/catalog';
import { getBillingGateway } from '@/lib/billing/providers/registry';
import type { WebBillingProvider, WebPaymentMethod } from '@/lib/billing/providers/contracts';

const PAYMENT_METHODS: WebPaymentMethod[] = ['pix', 'card', 'apple_pay', 'google_pay'];

function paymentMethod(value: unknown): WebPaymentMethod | null {
  return PAYMENT_METHODS.includes(value as WebPaymentMethod) ? value as WebPaymentMethod : null;
}

function userDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim();
  return user.email?.split('@')[0] || 'Flow Me customer';
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const interval = normalizeBillingInterval(body.interval || 'monthly');
    const method = paymentMethod(body.payment_method || 'card');
    const planCode = typeof body.plan_code === 'string' && body.plan_code.trim() ? body.plan_code.trim() : 'pro';
    const locale = normalizeCatalogLocale(body.locale);
    if (!interval) return apiError(ErrorCode.VALIDATION_ERROR, 'interval must be monthly or annual', 400);
    if (!method) return apiError(ErrorCode.VALIDATION_ERROR, 'payment_method is invalid', 400);
    if (method === 'pix' && (typeof body.customer_name !== 'string' || typeof body.cpf_cnpj !== 'string')) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'customer_name and cpf_cnpj are required for Pix', 400);
    }

    const admin = getSupabaseAdmin();
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

    const { data: previousAttempt } = await admin.from('billing_checkout_attempts')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .not('provider_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: subscription } = await admin.from('user_subscriptions')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .eq('billing_provider', provider)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: attempt, error: attemptError } = await admin.from('billing_checkout_attempts').insert({
      user_id: user.id,
      plan_code: planCode,
      price_id: price.id,
      provider,
      payment_method: method,
      billing_interval: interval,
      locale,
      currency: price.currency,
      amount_cents: price.amount_cents,
      status: 'created',
    }).select('id').single();
    if (attemptError || !attempt) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to initialize checkout', 500);

    try {
      const gateway = getBillingGateway(provider);
      const result = await gateway.createCheckout({
        attemptId: attempt.id,
        userId: user.id,
        userEmail: user.email || '',
        customerName: method === 'pix' ? String(body.customer_name).trim() : userDisplayName(user),
        customerTaxId: method === 'pix' ? String(body.cpf_cnpj) : null,
        existingCustomerId: subscription?.provider_customer_id || previousAttempt?.provider_customer_id || null,
        planCode,
        localizedName: localization.name,
        localizedDescription: localization.description,
        interval,
        paymentMethod: method,
        currency: price.currency,
        amountCents: price.amount_cents,
        providerPriceId: price.provider_price_id,
        returnUrl: `${appBaseUrl(req.url)}/app/checkout/return`,
      });
      const { error: updateError } = await admin.from('billing_checkout_attempts').update({
        status: 'awaiting_payment',
        provider_customer_id: result.providerCustomerId,
        provider_checkout_id: result.providerCheckoutId,
        provider_subscription_id: result.providerSubscriptionId,
        provider_payment_id: result.providerPaymentId,
        expires_at: result.expiresAt,
        updated_at: new Date().toISOString(),
      }).eq('id', attempt.id);
      if (updateError) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to save checkout state', 500);
      return apiSuccess({ attempt_id: attempt.id, checkout: result });
    } catch (gatewayError) {
      await admin.from('billing_checkout_attempts').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', attempt.id);
      const message = gatewayError instanceof Error && gatewayError.message === 'invalid CPF/CNPJ'
        ? 'CPF/CNPJ inválido'
        : 'Não foi possível iniciar o pagamento';
      const invalidDocument = gatewayError instanceof Error && gatewayError.message === 'invalid CPF/CNPJ';
      return apiError(invalidDocument ? ErrorCode.VALIDATION_ERROR : ErrorCode.PAYMENT_PROVIDER_ERROR, message, invalidDocument ? 400 : 502);
    }
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create checkout', 500);
  }
}
