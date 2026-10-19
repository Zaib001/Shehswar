import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../context/auth-context';
import { ThemeProvider } from '../context/theme-context';
import { ToastProvider } from '../context/toast-context';

export const metadata: Metadata = {
  title: 'SHEHSWAR ONE360 - Enterprise ERP & CRM',
  description: 'Scalable multi-company enterprise ERP and CRM platform for Shehswar Group',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
