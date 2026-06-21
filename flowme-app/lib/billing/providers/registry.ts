import { getAsaasGateway } from './asaas';
import type { BillingGateway, WebBillingProvider } from './contracts';
import { getStripeGateway } from './stripe';

export function getBillingGateway(provider: WebBillingProvider): BillingGateway {
  return provider === 'asaas' ? getAsaasGateway() : getStripeGateway();
}
