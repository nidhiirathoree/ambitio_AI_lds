'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, FileEdit, Brain, CheckCircle, AlertCircle, Zap, RefreshCw,
  TrendingUp, Database, Cpu, Search, GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ProcessedDocument, CaseFactsDraft, CorrectionPattern } from '@/lib/types';

interface Stats {
  documents: ProcessedDocument[];
  drafts: CaseFactsDraft[];
  patterns: CorrectionPattern[];
  cases: string[];
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLog, setDemoLog] = useState<string[]>([]);
  const router = useRouter();

  async function load() {
    setLoading(true);
    const [docsRes, draftsRes, patternsRes] = await Promise.all([
      fetch('/api/documents').then(r => r.json()).catch(() => ({ documents: [], cases: [] })),
      fetch('/api/drafts').then(r => r.json()).catch(() => ({ drafts: [] })),
      fetch('/api/patterns').then(r => r.json()).catch(() => ({ patterns: [] })),
    ]);
    setStats({
      documents: docsRes.documents || [],
      drafts: draftsRes.drafts || [],
      patterns: patternsRes.patterns || [],
      cases: docsRes.cases || [],
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runDemo() {
    setDemoLoading(true);
    setDemoLog(['Starting demo…']);
    try {
      const res = await fetch('/api/demo', { method: 'POST' });
      const data = await res.json();
      if (data.steps) setDemoLog(data.steps);
      await load();
      setTimeout(() => router.push('/drafts'), 1500);
    } catch (e) {
      setDemoLog(['Error: ' + String(e)]);
    }
    setDemoLoading(false);
  }

  const docCount = stats?.documents.length ?? 0;
  const draftCount = stats?.drafts.length ?? 0;
  const patternCount = stats?.patterns.length ?? 0;
  const caseCount = stats?.cases.length ?? 0;

  const avgCitRate = useMemo(() => {
    if (!stats?.drafts.length) return 0;
    return stats.drafts.reduce((sum, d) => {
      const total = d.sections.reduce((s, sec) => s + sec.bullets.length, 0);
      const cited = d.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0);
      return sum + (total > 0 ? cited / total : 0);
    }, 0) / stats.drafts.length * 100;
  }, [stats]);

  const hasData = docCount > 0;

  const kpis = [
    { label: 'Documents', value: docCount, icon: FileText, href: '/documents', sub: `${caseCount} case${caseCount === 1 ? '' : 's'}` },
    { label: 'Drafts', value: draftCount, icon: FileEdit, href: '/drafts', sub: 'Generated' },
    { label: 'Patterns', value: patternCount, icon: Brain, href: '/learning', sub: 'Learned' },
    { label: 'Grounding', value: `${avgCitRate.toFixed(0)}%`, icon: CheckCircle, href: '/evaluation', sub: 'Avg citation rate' },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Grounded legal document processing and draft generation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="primary" size="md" onClick={runDemo} loading={demoLoading}>
            <Zap className="w-3.5 h-3.5" />
            {demoLoading ? 'Running…' : 'Run demo'}
          </Button>
        </div>
      </div>

      {/* Demo log */}
      {demoLog.length > 0 && (
        <Card>
          <CardContent className="font-mono text-xs space-y-1 py-4">
            {demoLog.map((line, i) => (
              <div key={i} className={cn(
                'text-slate-400',
                line.startsWith('✓') && 'text-emerald-400',
                line.startsWith('Error') && 'text-rose-400'
              )}>
                {line}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, href, sub }) => (
          <button key={label} onClick={() => router.push(href)} className="text-left">
            <Card hover>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-2xl font-semibold text-white mt-1 tabular-nums">
                      {loading ? '—' : value}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{sub}</div>
                  </div>
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!hasData && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-white font-medium">No data yet</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
              Run the one-click demo to generate sample legal docs, process them, produce a grounded draft,
              and see the learning loop in action.
            </p>
            <div className="mt-6">
              <Button variant="primary" onClick={runDemo} loading={demoLoading}>
                <Zap className="w-3.5 h-3.5" /> Run demo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main grid */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu className="w-4 h-4 text-slate-400" /> System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Document Processing', ok: docCount > 0 },
                { label: 'Vector Index', ok: caseCount > 0 },
                { label: 'Draft Generation', ok: draftCount > 0 },
                { label: 'Learning Loop', ok: patternCount > 0 },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{label}</span>
                  <div className="flex items-center gap-1.5">
                    {ok
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      : <AlertCircle className="w-3.5 h-3.5 text-slate-600" />}
                    <span className={cn('text-xs', ok ? 'text-emerald-400' : 'text-slate-600')}>
                      {ok ? 'Ready' : 'Idle'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-4 h-4 text-slate-400" /> Grounding Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.drafts.slice(-4).map(draft => {
                const total = draft.sections.reduce((s, sec) => s + sec.bullets.length, 0);
                const cited = draft.sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0);
                const rate = total > 0 ? cited / total * 100 : 0;
                return (
                  <div key={draft.draftId}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-300 truncate font-mono">{draft.caseId} v{draft.version}</span>
                      <span className={cn('font-medium', rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400')}>{rate.toFixed(0)}%</span>
                    </div>
                    <Progress value={rate} barClassName={rate >= 80 ? 'bg-emerald-400' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'} />
                  </div>
                );
              })}
              {!draftCount && <p className="text-xs text-slate-500 text-center py-4">No drafts yet</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-slate-400" /> Latest Patterns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats?.patterns.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-start gap-2 text-xs">
                  <Badge variant={p.type === 'content' ? 'info' : p.type === 'phrasing' ? 'warning' : 'default'} className="shrink-0 mt-0.5">{p.type}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-300 leading-snug line-clamp-2">{p.instruction}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{p.count}× applied</p>
                  </div>
                </div>
              ))}
              {!patternCount && <p className="text-xs text-slate-500 text-center py-4">No patterns yet</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick nav */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Documents', href: '/documents', icon: FileText },
            { label: 'Retrieval', href: '/retrieval', icon: Search },
            { label: 'Review', href: '/review', icon: Brain },
            { label: 'Learning', href: '/learning', icon: GitBranch },
          ].map(({ label, href, icon: Icon }) => (
            <button key={label} onClick={() => router.push(href)} className="text-left">
              <Card hover>
                <CardContent className="py-4 flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{label}</span>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
