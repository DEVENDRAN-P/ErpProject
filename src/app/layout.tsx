import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AppShell from '@/components/AppShell';
import Logo from '@/components/ui/Logo';

export const metadata: Metadata = {
  title: {
    default: 'ProductPilot AI — Enterprise Product Intelligence',
    template: '%s | ProductPilot AI',
  },
  description: 'AI-powered industrial product data intelligence. Extract, validate, and enrich product specifications from datasheets, PDFs, and catalogs.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'ProductPilot AI',
    title: 'ProductPilot AI — Enterprise Product Intelligence',
    description: 'AI-powered industrial product data intelligence. Extract, validate, and enrich product specifications from datasheets, PDFs, and catalogs.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'ProductPilot AI',
      },
      {
        url: '/og-image-dark.svg',
        width: 1200,
        height: 630,
        alt: 'ProductPilot AI (Dark)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProductPilot AI — Enterprise Product Intelligence',
    description: 'AI-powered industrial product data intelligence. Extract, validate, and enrich product specifications from datasheets, PDFs, and catalogs.',
    images: ['/og-image.svg', '/og-image-dark.svg'],
  },
  other: {
    'theme-color': '#6366F1',
    'theme-color-dark': '#818CF8',
  },
  manifest: '/manifest.json',
  themeColor: '#6366F1',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={null}>
            <AppShell>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-pulse">
                      <Logo size={36} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Loading…</span>
                  </div>
                </div>
              }>
                {children}
              </Suspense>
            </AppShell>
          </Suspense>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
