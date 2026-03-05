'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',           label: 'Ask' },
  { href: '/scenario',  label: 'Scenario' },
  { href: '/fields',    label: 'Fields' },
  { href: '/conditions',label: 'Conditions' },
  { href: '/explore',   label: 'Explore' },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1 rounded-md transition-colors font-medium ${
              active
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
