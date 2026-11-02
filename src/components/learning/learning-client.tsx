'use client';
import { useEffect, useState } from 'react';
import { GitBranch, ArrowRight, Plus, TrendingUp, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, patternTypeColor } from '@/lib/utils';
import type { CaseFactsDraft, CorrectionPattern, EditEvent } from '@/lib/types';

export function LearningClient() {
  const [patterns, setPatterns] = useState<CorrectionPattern[]>([]);
  const [events, setEvents] = useState<EditEvent[]>([]);
  const [v1, setV1] = useState<CaseFactsDraft | null>(null);
  const [v2, setV2] = useState<CaseFactsDraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [dr, pt, ev] = await Promise.all([
        fetch('/api/drafts').then(r => r.json()).catch(() => ({ drafts: [] })),
        fetch('/api/patterns').then(r => r.json()).catch(() => ({ patterns: [] })),
        fetch('/api/edits').then(r => r.json()).catch(() => ({ events: [] })),
      ]);
      const sorted: CaseFactsDraft[] = (dr.drafts || []).sort((a: CaseFactsDraft, b: CaseFactsDraft) => a.version - b.version);
      setPatterns(pt.patterns || []);
      setEvents(ev.events || []);
      if (sorted.length >= 2) { setV1(sorted[0]); setV2(sorted[sorted.length - 1]); }
      else if (sorted.length === 1) setV1(sorted[0]);
      setLoading(false);
    }
    load();
  }, []);

  const bulletsV1 = v1?.sections.reduce((s, sec) => s + sec.bullets.length, 0) ?? 0;
  const bulletsV2 = v2?.sections.reduce((s, sec) => s + sec.bullets.length, 0) ?? 0;
  const citedV1 = v1?.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0) ?? 0;
  const citedV2 = v2?.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0) ?? 0;
  const rateV1 = bulletsV1 > 0 ? citedV1 / bulletsV1 * 100 : 0;
  const rateV2 = bulletsV2 > 0 ? citedV2 / bulletsV2 * 100 : 0;
  const improved = v2 && v2.draftId !== v1?.draftId;

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Learning Loop</h1>
        <p className="text-sm text-slate-500 mt-1">How operator edits become reusable patterns that improve future drafts</p>
      </div>

      {/* Flow */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {[
              { icon: Brain, label: 'V1 Draft', sub: 'baseline' },
              { icon: GitBranch, label: 'Operator Edit', sub: 'corrects' },
              { icon: Brain, label: 'Pattern Extraction', sub: 'LLM + rules' },
              { icon: TrendingUp, label: 'V2+ Draft', sub: 'patterns applied' },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="flex items-center gap-3 flex-1 min-w-[160px]">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-9 h-9 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-slate-300" />
                  </div>
                  <div>
                    <div className="text-xs text-white font-medium">{label}</div>
                    <div className="text-[10px] text-slate-500">{sub}</div>
                  </div>
                </div>
                {i < 3 && <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Edit Events" value={events.length} sub="Operator corrections captured" icon={GitBranch} />
        <MetricCard label="Patterns Learned" value={patterns.length} sub="Reusable rules extracted" icon={Brain} />
        <MetricCard
          label="Bullet Δ"
          value={`${bulletsV2 >= bulletsV1 ? '+' : ''}${bulletsV2 - bulletsV1}`}
          sub={`${bulletsV1} → ${bulletsV2} bullets`}
          icon={TrendingUp}
        />
      </div>

      {/* Before / After */}
      {v1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="ghost">V{v1.version} · Before</Badge>
              <span className="text-xs text-slate-500">No patterns</span>
            </div>
            <GroundingCard rate={rateV1} bullets={bulletsV1} cited={citedV1} label="V1" />
            <div className="space-y-2">
              {v1.sections.slice(0, 4).map(s => <SectionPreview key={s.heading} section={s} highlight={[]} />)}
            </div>
          </div>

          {improved ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="success">V{v2!.version} · After</Badge>
                <span className="text-xs text-slate-500">{patterns.length} pattern{patterns.length === 1 ? '' : 's'} applied</span>
              </div>
              <GroundingCard rate={rateV2} bullets={bulletsV2} cited={citedV2} label="V2" improved={rateV2 > rateV1} />
              <div className="space-y-2">
                {v2!.sections.slice(0, 4).map(sec => {
                  const v1sec = v1.sections.find(s => s.heading === sec.heading);
                  const added = v1sec ? sec.bullets.filter(b2 => !v1sec.bullets.some(b1 => b1.text === b2.text)) : [];
                  return <SectionPreview key={sec.heading} section={sec} highlight={added.map(b => b.text)} />;
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-slate-500">
                <TrendingUp className="w-7 h-7 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Generate V2 to see improvement</p>
                <p className="text-xs mt-1 text-slate-600">Save an edit in Review, then generate again</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Learned Correction Patterns</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patterns.map(p => (
                <div key={p.id} className="flex items-start gap-3 p-3 bg-slate-950 rounded-md border border-slate-800">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5', patternTypeColor(p.type))}>
                    {p.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 font-medium">{p.instruction}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Trigger: <span className="font-mono">{p.trigger}</span></p>
                    {p.examples[0] && (
                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        <span className="text-rose-400/70 line-through truncate">{p.examples[0].original || '—'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        <span className="text-emerald-400 truncate">{p.examples[0].edited}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="ghost" className="shrink-0">{p.count}×</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !v1 && (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <GitBranch className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No data yet</p>
            <p className="text-xs mt-1 text-slate-600">Run the demo pipeline from the Dashboard</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: {
  label: string; value: string | number; sub: string; icon: React.FC<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-2xl font-semibold text-white mt-1 tabular-nums">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{sub}</div>
          </div>
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
      </CardContent>
    </Card>
  );
}

function GroundingCard({ rate, bullets, cited, label, improved }: {
  rate: number; bullets: number; cited: number; label: string; improved?: boolean;
}) {
  const color = rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400';
  return (
    <div className={cn(
      'p-3 rounded-md border bg-slate-900',
      improved ? 'border-emerald-500/30' : 'border-slate-800'
    )}>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-300">{label} citation rate</span>
        <span className={cn('font-mono', color)}>{cited}/{bullets} = {rate.toFixed(0)}%</span>
      </div>
      <Progress value={rate} barClassName={rate >= 80 ? 'bg-emerald-400' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'} />
    </div>
  );
}

function SectionPreview({ section, highlight }: {
  section: { heading: string; bullets: Array<{ text: string; citations: Array<unknown> }> };
  highlight: string[];
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-3">
      <div className="text-xs font-medium text-slate-300 mb-2">{section.heading}</div>
      {section.bullets.map((b, i) => {
        const isNew = highlight.includes(b.text);
        return (
          <div key={i} className={cn(
            'flex items-start gap-2 mb-1 text-[11px] leading-relaxed',
            isNew && 'bg-emerald-500/5 border border-emerald-500/15 rounded px-2 py-1 -mx-1'
          )}>
            {isNew
              ? <Plus className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              : <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', b.citations.length > 0 ? 'bg-emerald-400' : 'bg-rose-400')} />}
            <span className={cn(isNew ? 'text-emerald-300' : 'text-slate-400', 'line-clamp-2')}>
              {isNew && <span className="text-[10px] text-emerald-500 font-medium mr-1">[ADDED]</span>}
              {b.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
