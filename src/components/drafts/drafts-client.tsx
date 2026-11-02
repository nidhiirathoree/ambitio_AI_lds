'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileEdit, Plus, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn, formatDate } from '@/lib/utils';
import type { CaseFactsDraft } from '@/lib/types';
import { DraftViewer } from './draft-viewer';

export function DraftsClient() {
  const [drafts, setDrafts] = useState<CaseFactsDraft[]>([]);
  const [selected, setSelected] = useState<CaseFactsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [caseIdInput, setCaseIdInput] = useState('sample-001');
  const router = useRouter();

  async function load() {
    setLoading(true);
    const res = await fetch('/api/drafts').then(r => r.json()).catch(() => ({ drafts: [] }));
    const list = (res.drafts || []).sort((a: CaseFactsDraft, b: CaseFactsDraft) => b.version - a.version);
    setDrafts(list);
    if (!selected && list.length > 0) setSelected(list[0]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!caseIdInput.trim()) return;
    setGenerating(true);
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: caseIdInput }),
    }).then(r => r.json());
    if (res.draft) { await load(); setSelected(res.draft); }
    setGenerating(false);
  }

  const citationRate = (d: CaseFactsDraft) => {
    const total = d.sections.reduce((s, sec) => s + sec.bullets.length, 0);
    const cited = d.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0);
    return total > 0 ? cited / total * 100 : 0;
  };

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white">Drafts</h1>
          <p className="text-sm text-slate-500 mt-1">Grounded draft generation with citations to source evidence</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={caseIdInput} onChange={e => setCaseIdInput(e.target.value)} placeholder="Case ID" className="w-40" />
          <Button variant="primary" onClick={generate} loading={generating}>
            <Plus className="w-3.5 h-3.5" /> Generate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List */}
        <aside className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between text-xs px-1 mb-1">
            <span className="text-slate-500">All drafts</span>
            <span className="text-slate-600 font-mono">{drafts.length}</span>
          </div>
          {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-20" />)}
          {!loading && drafts.map(d => {
            const rate = citationRate(d);
            const active = selected?.draftId === d.draftId;
            return (
              <button
                key={d.draftId}
                onClick={() => setSelected(d)}
                className={cn(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  active ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white truncate">{d.caseId}</span>
                  <Badge variant={d.unsupportedClaims.length === 0 ? 'success' : 'warning'}>v{d.version}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={rate} className="flex-1" barClassName={rate >= 80 ? 'bg-emerald-400' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'} />
                  <span className={cn(
                    'text-[11px] font-mono',
                    rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400'
                  )}>{rate.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
                  <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                  {d.unsupportedClaims.length > 0 && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {d.unsupportedClaims.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {!loading && !drafts.length && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                <FileEdit className="w-7 h-7 mx-auto mb-2 opacity-50" />
                No drafts yet
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Viewer */}
        <section className="lg:col-span-8">
          {selected ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant={selected.unsupportedClaims.length === 0 ? 'success' : 'warning'}>
                        {selected.unsupportedClaims.length === 0 ? 'Fully grounded' : `${selected.unsupportedClaims.length} unsupported`}
                      </Badge>
                      <Badge variant="info">v{selected.version}</Badge>
                      <span className="text-xs text-slate-500">{selected.retrievedChunks.length} chunks</span>
                    </div>
                    <h2 className="text-lg font-semibold text-white">Case Facts: {selected.caseId}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{formatDate(selected.createdAt)}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/review?draftId=${selected.draftId}`)}>
                    <ExternalLink className="w-3.5 h-3.5" /> Review
                  </Button>
                </CardContent>
              </Card>

              <GroundingBar draft={selected} />
              <DraftViewer draft={selected} />

              {selected.unsupportedClaims.length > 0 && (
                <Card className="border-rose-500/30">
                  <CardContent className="py-4">
                    <div className="text-rose-400 flex items-center gap-2 text-sm font-medium mb-3">
                      <AlertCircle className="w-4 h-4" /> Unsupported Claims · {selected.unsupportedClaims.length}
                    </div>
                    <div className="space-y-1.5">
                      {selected.unsupportedClaims.map((c, i) => (
                        <div key={i} className="text-xs text-rose-300 bg-rose-500/5 border border-rose-500/15 px-3 py-2 rounded-md">{c}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-20 text-center text-slate-500">
                <FileEdit className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a draft or generate one</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function GroundingBar({ draft }: { draft: CaseFactsDraft }) {
  const total = draft.sections.reduce((s, sec) => s + sec.bullets.length, 0);
  const cited = draft.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0);
  const rate = total > 0 ? cited / total * 100 : 0;
  const color = rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400';

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Grounding Score</span>
              <span className={cn('font-mono', color)}>{cited}/{total} bullets cited</span>
            </div>
            <Progress value={rate} barClassName={rate >= 80 ? 'bg-emerald-400' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'} />
          </div>
          <div className="text-center">
            <div className={cn('text-2xl font-semibold tabular-nums', color)}>{rate.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">grounded</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
