import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'ProductPilot AI',
  description: 'AI-powered industrial product data intelligence'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--neutral-200)]" style={{ borderTopColor: "var(--accent-primary)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Loading…</span>
                </div>
              </div>
            }>
              {children}
            </Suspense>
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
