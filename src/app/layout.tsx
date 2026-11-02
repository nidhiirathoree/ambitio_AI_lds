import type { Metadata } from 'next';
import './globals.css';
import { TopNav } from '@/components/layout/topnav';

export const metadata: Metadata = {
  title: 'Ambitio — Legal Drafts AI',
  description: 'Grounded legal document understanding and draft generation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#020617] text-slate-100">
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
