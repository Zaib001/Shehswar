import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../context/auth-context';

export const metadata: Metadata = {
  title: 'SHEHSWAR ONE360 - Enterprise ERP & CRM',
  description: 'Scalable multi-company enterprise ERP and CRM platform for Shehswar Group',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
