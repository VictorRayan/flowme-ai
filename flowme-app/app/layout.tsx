import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
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
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} ${plusJakarta.variable} ${inter.className}`}>
        <ThemeRegistry>{children}</ThemeRegistry>
        <Script id="microsoft-clarity" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityProjectId}");
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
