import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { annualSavings, normalizeCatalogLocale } from '@/lib/billing/catalog';

type LocalizationRow = {
  plan_code: string;
  locale: string;
  name: string;
  short_description: string;
  description: string;
  checkout_badge: string | null;
  checkout_cta: string;
  feature_highlights: unknown;
};

type PriceRow = {
  id: string;
  plan_code: string;
  billing_provider: string;
  billing_interval: 'monthly' | 'annual';
  currency: string;
  amount_cents: number;
};

export async function GET(req: NextRequest) {
  try {
    const locale = normalizeCatalogLocale(req.nextUrl.searchParams.get('locale'));
    const admin = getSupabaseAdmin();
    const [{ data: localized, error: localeError }, { data: prices, error: priceError }, { data: routes, error: routeError }] = await Promise.all([
      admin.from('subscription_plan_localizations')
        .select('plan_code,locale,name,short_description,description,checkout_badge,checkout_cta,feature_highlights')
        .eq('locale', locale),
      admin.from('subscription_prices')
        .select('id,plan_code,billing_provider,billing_interval,currency,amount_cents')
        .eq('active', true)
        .in('billing_provider', ['stripe', 'asaas'])
        .order('amount_cents', { ascending: true }),
      admin.from('billing_payment_method_routes')
        .select('payment_method,provider,currency,priority')
        .eq('enabled', true)
        .order('priority', { ascending: true }),
    ]);
    if (localeError || priceError || routeError) {
      return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to load the billing catalog', 500);
    }

    let localizations = (localized || []) as LocalizationRow[];
    if (localizations.length === 0 && locale !== 'pt-BR') {
      const { data, error } = await admin.from('subscription_plan_localizations')
        .select('plan_code,locale,name,short_description,description,checkout_badge,checkout_cta,feature_highlights')
        .eq('locale', 'pt-BR');
      if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to load the billing catalog', 500);
      localizations = (data || []) as LocalizationRow[];
    }

    const priceRows = (prices || []) as PriceRow[];
    const plans = localizations.map(localization => {
      const planPrices = priceRows.filter(price => price.plan_code === localization.plan_code);
      const monthly = planPrices.find(price => price.billing_interval === 'monthly' && price.billing_provider === 'stripe')
        || planPrices.find(price => price.billing_interval === 'monthly');
      const annual = planPrices.find(price => price.billing_interval === 'annual' && price.billing_provider === 'stripe')
        || planPrices.find(price => price.billing_interval === 'annual');
      return {
        code: localization.plan_code,
        locale: localization.locale,
        name: localization.name,
        short_description: localization.short_description,
        description: localization.description,
        checkout_badge: localization.checkout_badge,
        checkout_cta: localization.checkout_cta,
        feature_highlights: Array.isArray(localization.feature_highlights) ? localization.feature_highlights : [],
        prices: planPrices.map(price => ({
          interval: price.billing_interval,
          currency: price.currency,
          amount_cents: price.amount_cents,
        })),
        annual_savings: monthly && annual ? annualSavings(monthly.amount_cents, annual.amount_cents) : { amountCents: 0, percent: 0 },
      };
    });

    return apiSuccess({
      locale,
      plans,
      payment_methods: routes || [],
    });
  } catch {
    return apiError(ErrorCode.INTERNAL_ERROR, 'Unable to load the billing catalog', 500);
  }
}
