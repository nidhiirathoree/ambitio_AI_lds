import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatConfidence(val: number | null | undefined): string {
  if (val == null) return 'N/A';
  return `${val.toFixed(1)}%`;
}

export function confidenceColor(val: number): string {
  if (val >= 85) return 'text-green-400';
  if (val >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

export function scoreColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 0.4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

export function patternTypeColor(type: string): string {
  const map: Record<string, string> = {
    phrasing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    content: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    structure: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    section_name: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    citation: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };
  return map[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
