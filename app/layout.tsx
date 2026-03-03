import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold text-white tracking-tight">
              Saaf Ontology
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                Ask
              </Link>
              <Link href="/scenario" className="text-gray-400 hover:text-white transition-colors">
                Scenario
              </Link>
              <Link href="/fields" className="text-gray-400 hover:text-white transition-colors">
                Fields
              </Link>
              <Link href="/conditions" className="text-gray-400 hover:text-white transition-colors">
                Conditions
              </Link>
              <Link href="/explore" className="text-gray-400 hover:text-white transition-colors">
                Explore
              </Link>
            </nav>
            <div className="ml-auto text-xs text-gray-600">974 embeddings · gte-small</div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
