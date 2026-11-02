'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Search, FileEdit, GitBranch,
  BarChart3, Network, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Retrieval', href: '/retrieval', icon: Search },
  { label: 'Drafts', href: '/drafts', icon: FileEdit },
  { label: 'Review', href: '/review', icon: Brain },
  { label: 'Learning', href: '/learning', icon: GitBranch },
  { label: 'Evaluation', href: '/evaluation', icon: BarChart3 },
  { label: 'Architecture', href: '/architecture', icon: Network },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-sky-400 flex items-center justify-center">
            <span className="text-slate-950 text-xs font-bold">A</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-white leading-none">Ambitio</div>
            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">Legal Drafts AI</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
