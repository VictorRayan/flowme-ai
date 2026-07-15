'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

type GoogleAnalyticsProps = {
  measurementId: string;
};

const linkerDomains = ['flow-me.online', 'app.flow-me.online'];

export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const initialPageviewHandled = useRef(false);

  useEffect(() => {
    if (!initialPageviewHandled.current) {
      initialPageviewHandled.current = true;
      return;
    }
    if (!window.gtag) return;
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      page_title: document.title,
    });
  }, [pathname]);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', '${measurementId}', {
          cookie_domain: window.location.hostname.endsWith('flow-me.online') ? 'flow-me.online' : 'auto',
          linker: {
            domains: ${JSON.stringify(linkerDomains)}
          }
        });
      `}</Script>
    </>
  );
}
