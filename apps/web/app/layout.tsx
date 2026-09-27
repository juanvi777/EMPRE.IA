import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

export const metadata: Metadata = {
  title: 'EMPRE.IA — Centro de inteligencia empresarial',
  description: 'EMPRE.IA: tu empresa, más inteligente.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-180.png',
  },
  themeColor: '#071426',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
