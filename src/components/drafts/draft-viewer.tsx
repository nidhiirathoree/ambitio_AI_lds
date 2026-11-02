'use client';
import { useState } from 'react';
import { Link, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CaseFactsDraft, DraftBullet, Citation } from '@/lib/types';

export function DraftViewer({ draft }: { draft: CaseFactsDraft }) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(draft.sections.map(s => s.heading)));

  function toggle(heading: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(heading) ? next.delete(heading) : next.add(heading);
      return next;
    });
  }

  return (
    <div className="space-y-3 relative">
      {draft.sections.map(section => {
        const isOpen = expanded.has(section.heading);
        const cited = section.bullets.filter(b => b.citations.length > 0).length;
        const total = section.bullets.length;
        const pct = total > 0 ? Math.round(cited / total * 100) : 0;

        return (
          <div key={section.heading} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(section.heading)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{section.heading}</span>
                <span className="text-xs text-slate-500">{section.bullets.length} bullets</span>
                <span className={cn('text-xs font-mono', pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400')}>
                  {cited}/{total} cited
                </span>
              </div>
              {isOpen
                ? <ChevronUp className="w-4 h-4 text-slate-500" />
                : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {isOpen && (
              <div className="px-5 pb-4 space-y-2 border-t border-slate-800 pt-3">
                {section.bullets.map((bullet, bi) => (
                  <BulletRow key={bi} bullet={bullet} activeCitation={activeCitation} onCitationClick={setActiveCitation} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Citation panel */}
      {activeCitation && (
        <div className="fixed bottom-6 right-6 w-80 z-50 animate-fade-in">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-white">Evidence</span>
              </div>
              <button onClick={() => setActiveCitation(null)} className="text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="text-[10px] text-slate-500 font-mono break-all">{activeCitation.chunkId}</div>
              {activeCitation.docId && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="info">{activeCitation.docId}</Badge>
                  {activeCitation.pageNumber && <Badge variant="ghost">p{activeCitation.pageNumber}</Badge>}
                </div>
              )}
              <blockquote className="text-sm text-slate-200 bg-slate-900 border-l-2 border-slate-600 pl-3 py-2 italic">
                "{activeCitation.quote}"
              </blockquote>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BulletRow({ bullet, activeCitation, onCitationClick }: {
  bullet: DraftBullet;
  activeCitation: Citation | null;
  onCitationClick: (c: Citation | null) => void;
}) {
  const isUnsupported = bullet.text.includes('Not stated') ||
    (bullet.citations.length === 0 && bullet.text.length > 40);

  return (
    <div className={cn('flex gap-3 pt-2', isUnsupported && 'opacity-70')}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full mt-2 shrink-0',
        bullet.citations.length > 0 ? 'bg-emerald-400' : 'bg-rose-400'
      )} />
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm leading-relaxed', isUnsupported ? 'text-slate-400' : 'text-slate-200')}>
          {bullet.text}
        </span>
        {bullet.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {bullet.citations.map((cit, ci) => {
              const active = activeCitation?.chunkId === cit.chunkId;
              return (
                <button
                  key={ci}
                  onClick={() => onCitationClick(active ? null : cit)}
                  className={cn('citation-tag', active && 'bg-slate-700 text-white border-slate-600')}
                >
                  <Link className="w-2.5 h-2.5" />
                  {cit.chunkId.slice(-8)}
                </button>
              );
            })}
          </div>
        )}
        {isUnsupported && (
          <div className="mt-1.5 text-[10px] text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> No source evidence — hallucination guard active
          </div>
        )}
      </div>
    </div>
  );
}
