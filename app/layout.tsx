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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen`}>
        <header className="border-b border-gray-200 bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold text-gray-900 tracking-tight">
              Saaf Ontology
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
                Ask
              </Link>
              <Link href="/scenario" className="text-gray-500 hover:text-gray-900 transition-colors">
                Scenario
              </Link>
              <Link href="/fields" className="text-gray-500 hover:text-gray-900 transition-colors">
                Fields
              </Link>
              <Link href="/conditions" className="text-gray-500 hover:text-gray-900 transition-colors">
                Conditions
              </Link>
              <Link href="/explore" className="text-gray-500 hover:text-gray-900 transition-colors">
                Explore
              </Link>
            </nav>
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
