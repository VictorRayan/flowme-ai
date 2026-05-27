export type BriefingChannel = 'web' | 'whatsapp' | 'push';

export function buildBriefingDelivery(opts: { whatsappLinked?: boolean; pushGranted?: boolean }): BriefingChannel[] {
  const delivery: BriefingChannel[] = ['web'];
  if (opts.whatsappLinked) delivery.push('whatsapp');
  if (opts.pushGranted) delivery.push('push');
  return delivery;
}
