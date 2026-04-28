import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DSD Lab Invoice Manager',
  description: 'Dream Smiles Dental — internal lab invoice management',
  robots: { index: false, follow: false }, // internal tool
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={dmSans.variable}>
      <body className="min-h-screen bg-eggshell font-sans text-slate">{children}</body>
    </html>
  );
}
