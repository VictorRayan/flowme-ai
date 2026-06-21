'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Alert, Snackbar } from '@mui/material';
import type { FeatureKey, UserEntitlements } from '@/lib/billing/entitlements';
import type { BillingInterval } from '@/lib/billing/pricing';
import UpgradeDialog from './UpgradeDialog';
import BillingAlert from './BillingAlert';

type BillingInfo = {
  provider: 'stripe' | 'asaas' | 'apple' | 'google' | null;
  state: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  management_surface: 'stripe' | 'apple' | 'google' | 'none';
};

type UpgradeReason = 'feature' | 'credits' | 'general';

type SubscriptionContextValue = {
  entitlements: UserEntitlements | null;
  billing: BillingInfo | null;
  loading: boolean;
  isAllowed: (feature: FeatureKey) => boolean;
  refresh: (force?: boolean) => Promise<UserEntitlements | null>;
  openUpgrade: (options?: { feature?: FeatureKey; reason?: UpgradeReason }) => void;
  closeUpgrade: () => void;
};

type EntitlementsPayload = {
  ok: boolean;
  entitlements?: UserEntitlements;
  billing?: BillingInfo;
  error?: { message?: string };
};

type UpgradeEventDetail = {
  feature?: FeatureKey;
  reason?: UpgradeReason;
};

const CACHE_TTL_MS = 30_000;
const SubscriptionContext = React.createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [entitlements, setEntitlements] = React.useState<UserEntitlements | null>(null);
  const [billing, setBilling] = React.useState<BillingInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkoutResult, setCheckoutResult] = React.useState<'success' | 'cancelled' | null>(null);
  const [upgrade, setUpgrade] = React.useState<{ open: boolean; feature: FeatureKey | null; reason: UpgradeReason }>({
    open: false,
    feature: null,
    reason: 'general',
  });
  const fetchedAt = React.useRef(0);
  const entitlementsRef = React.useRef<UserEntitlements | null>(null);
  const polling = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialQuery = React.useRef(
    typeof window === 'undefined' ? '' : window.location.search,
  );

  const refresh = React.useCallback(async (force = false) => {
    if (!force && Date.now() - fetchedAt.current < CACHE_TTL_MS && entitlementsRef.current) {
      return entitlementsRef.current;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/billing/entitlements', { cache: 'no-store' });
      const payload = await response.json() as EntitlementsPayload;
      if (!response.ok || !payload.ok || !payload.entitlements || !payload.billing) {
        throw new Error(payload.error?.message || 'Não foi possível verificar sua assinatura.');
      }
      fetchedAt.current = Date.now();
      entitlementsRef.current = payload.entitlements;
      setEntitlements(payload.entitlements);
      setBilling(payload.billing);
      window.dispatchEvent(new CustomEvent('flowme:entitlements-updated', { detail: payload.entitlements }));
      return payload.entitlements;
    } finally {
      setLoading(false);
    }
  }, []);

  const openUpgrade = React.useCallback((options?: { feature?: FeatureKey; reason?: UpgradeReason }) => {
    setUpgrade({
      open: true,
      feature: options?.feature || null,
      reason: options?.reason || (options?.feature ? 'feature' : 'general'),
    });
  }, []);

  const closeUpgrade = React.useCallback(() => {
    setUpgrade(current => ({ ...current, open: false }));
  }, []);

  React.useEffect(() => {
    refresh().catch(() => undefined);
  }, [pathname, refresh]);

  React.useEffect(() => {
    const onUpgrade = (event: Event) => {
      const detail = (event as CustomEvent<UpgradeEventDetail>).detail;
      openUpgrade(detail);
    };
    window.addEventListener('flowme:upgrade', onUpgrade);
    return () => window.removeEventListener('flowme:upgrade', onUpgrade);
  }, [openUpgrade]);

  React.useEffect(() => {
    const query = initialQuery.current || window.location.search;
    initialQuery.current = '';
    const params = new URLSearchParams(query);
    const lockedFeature = params.get('upgrade') as FeatureKey | null;
    if (lockedFeature) openUpgrade({ feature: lockedFeature });

    const billingResult = params.get('billing');
    if (billingResult === 'cancelled') {
      setCheckoutResult('cancelled');
      return;
    }
    if (billingResult !== 'success') return;
    setCheckoutResult('success');
    let attempt = 0;
    const poll = async () => {
      attempt += 1;
      const next = await refresh(true).catch(() => null);
      if (next?.has_pro || attempt >= 6) return;
      polling.current = setTimeout(poll, Math.min(1000 * (2 ** attempt), 8000));
    };
    poll();
    return () => {
      if (polling.current) clearTimeout(polling.current);
    };
  }, [openUpgrade, pathname, refresh]);

  const startCheckout = React.useCallback(async (interval: BillingInterval) => {
    window.location.assign(`/app/checkout?interval=${interval}`);
  }, []);

  const isAllowed = React.useCallback((feature: FeatureKey) => {
    if (!entitlements) return true;
    return entitlements.features[feature] === true;
  }, [entitlements]);

  const value = React.useMemo<SubscriptionContextValue>(() => ({
    entitlements,
    billing,
    loading,
    isAllowed,
    refresh,
    openUpgrade,
    closeUpgrade,
  }), [billing, closeUpgrade, entitlements, isAllowed, loading, openUpgrade, refresh]);

  return (
    <SubscriptionContext.Provider value={value}>
      <BillingAlert />
      {children}
      <UpgradeDialog
        open={upgrade.open}
        feature={upgrade.feature}
        reason={upgrade.reason}
        onClose={closeUpgrade}
        onCheckout={startCheckout}
      />
      <Snackbar
        open={Boolean(checkoutResult)}
        autoHideDuration={checkoutResult === 'success' ? 8000 : 5000}
        onClose={() => setCheckoutResult(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={checkoutResult === 'success' ? 'success' : 'info'} onClose={() => setCheckoutResult(null)}>
          {checkoutResult === 'success'
            ? 'Pagamento confirmado. Estamos liberando seu Flow Me Pro.'
            : 'Checkout cancelado. Nenhuma cobrança foi feita.'}
        </Alert>
      </Snackbar>
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const value = React.useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return value;
}

export function requestUpgrade(options?: UpgradeEventDetail): void {
  window.dispatchEvent(new CustomEvent('flowme:upgrade', { detail: options }));
}
