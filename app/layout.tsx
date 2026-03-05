import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import NavLinks from './components/NavLinks';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Saaf Ontology Explorer',
  description: 'Explore the DSCR loan ontology — concepts, fields, and conditions',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen`}>
        <header className="border-b border-gray-200 bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold text-gray-900 tracking-tight">
              Saaf Ontology
            </Link>
            <NavLinks />
            <div className="ml-auto text-xs text-gray-400">974 embeddings · gte-small</div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
