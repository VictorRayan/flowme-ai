import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
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
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
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
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} ${plusJakarta.variable} ${inter.className}`}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
