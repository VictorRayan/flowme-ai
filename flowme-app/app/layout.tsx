import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import ThemeRegistry from '@/components/ThemeRegistry';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.flow-me.online'),
  title: 'Flow Me',
  description: 'Productivity + AI orchestration platform',
  icons: {
    icon: [
      { url: '/brand/flowme-icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Flow Me',
    description: 'Seu Jarvis pessoal para rotina, trabalho e vida real.',
    url: '/',
    siteName: 'Flow Me',
    images: [{ url: '/og/flowme-preview.png', width: 1200, height: 630, alt: 'Flow Me' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flow Me',
    description: 'Seu Jarvis pessoal para rotina, trabalho e vida real.',
    images: ['/og/flowme-preview.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'xkzkqxbqku';
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-942EZBWS43';
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} ${plusJakarta.variable} ${inter.className}`}>
        <ThemeRegistry>{children}</ThemeRegistry>
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(w,d,i){
            w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};
            function cookie(name){
              var match=d.cookie.match(new RegExp('(?:^|;\\\\s*)'+name+'=([^;]+)'));
              return match ? decodeURIComponent(match[1]) : '';
            }
            function identity(){
              try {
                var params=new URLSearchParams(w.location.search);
                var externalId=params.get('external_id') || w.localStorage.getItem('flowme_meta_external_id') || '';
                if (externalId) w.localStorage.setItem('flowme_meta_external_id', externalId);
                return externalId || cookie('_fbp') || w.localStorage.getItem('flowme_clarity_anon_id') || '';
              } catch (_) {
                return cookie('_fbp') || '';
              }
            }
            function identify(){
              var id=identity();
              if (!id) {
                id=(w.crypto && w.crypto.randomUUID ? w.crypto.randomUUID() : String(Date.now())+'-'+Math.random().toString(16).slice(2));
                try { w.localStorage.setItem('flowme_clarity_anon_id', id); } catch (_) {}
              }
              w.clarity('identify', id);
            }
            function load(){
              if(w.__FM_CLARITY_LOADED__) return;
              w.__FM_CLARITY_LOADED__=true;
              identify();
              var s=d.createElement('script');
              s.async=true;
              s.src='https://www.clarity.ms/tag/'+i;
              d.head.appendChild(s);
            }
            if('requestIdleCallback' in w) w.requestIdleCallback(load,{timeout:2500});
            else w.setTimeout(load,1600);
          })(window, document, "${clarityProjectId}");
        `}</Script>
        {pixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          `}</Script>
        )}
      </body>
    </html>
  );
}
