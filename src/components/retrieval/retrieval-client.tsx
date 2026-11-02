'use client';
import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, scoreColor } from '@/lib/utils';
import type { ScoredChunk } from '@/lib/types';

interface RetrievalResponse {
  query: string;
  chunks: ScoredChunk[];
  totalConsidered: number;
  topK: number;
  rejectedChunks: Array<{ chunkId: string; score: number; reason: string }>;
}

const EXAMPLE_QUERIES = [
  'parties plaintiff defendant roles',
  'dates chronology timeline events',
  'damages amounts monetary relief',
  'procedural history filings court',
  'claims allegations breach contract',
];

export function RetrievalClient() {
  const [query, setQuery] = useState('');
  const [caseId, setCaseId] = useState('sample-001');
  const [result, setResult] = useState<RetrievalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  async function search(q?: string) {
    const queryText = q || query;
    if (!queryText.trim()) return;
    setQuery(queryText);
    setLoading(true);
    const res = await fetch('/api/retrieval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText, caseId: caseId || undefined, topK: 12 }),
    }).then(r => r.json());
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Retrieval</h1>
        <p className="text-sm text-slate-500 mt-1">Inspect how evidence is retrieved and ranked for draft generation</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter a retrieval query…"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <Input value={caseId} onChange={e => setCaseId(e.target.value)} placeholder="Case ID" className="md:w-40" />
            <Button variant="primary" onClick={() => search()} loading={loading}>
              <Search className="w-3.5 h-3.5" /> Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => search(q)}
                className="text-[11px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-16" />)}
        </div>
      )}

      {result && !loading && (
        <>
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="text-white font-medium">"{result.query}"</span>
            <span>·</span>
            <span className="text-emerald-400">{result.chunks.length} retrieved</span>
            <span>·</span>
            <span>{result.totalConsidered} considered</span>
            <span>·</span>
            <span>{result.rejectedChunks?.length ?? 0} rejected by MMR</span>
          </div>

          {/* Pipeline */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {[
                  { label: '8 queries', desc: 'expansion' },
                  { label: `${result.totalConsidered}`, desc: 'candidates' },
                  { label: 'MMR', desc: 'rerank' },
                  { label: `${result.chunks.length}`, desc: 'top-k' },
                ].map((step, i) => (
                  <div key={step.desc} className="flex items-center gap-3">
                    {i > 0 && <span className="text-slate-700">→</span>}
                    <div>
                      <div className="font-medium text-white font-mono">{step.label}</div>
                      <div className="text-slate-500 text-[10px]">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chunks */}
          <div className="space-y-2">
            {result.chunks.map(({ chunk, score }, i) => {
              const expanded = expandedChunk === chunk.chunkId;
              return (
                <Card key={chunk.chunkId} className={cn(expanded && 'border-slate-600')}>
                  <button className="w-full text-left" onClick={() => setExpandedChunk(expanded ? null : chunk.chunkId)}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn('text-xs font-mono px-2 py-0.5 rounded border', scoreColor(score))}>
                            {score.toFixed(3)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono truncate">{chunk.chunkId}</span>
                          <Badge variant="ghost">
                            <FileText className="w-2.5 h-2.5" />{chunk.docId} · p{chunk.pageNumber}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{chunk.text.slice(0, 140)}…</p>
                      </div>
                      {expanded
                        ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 border-t border-slate-800 pt-3 animate-fade-in">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <Metric label="Similarity" value={score.toFixed(4)} highlight={score >= 0.6} />
                        <Metric label="Tokens" value={String(chunk.tokenCount)} />
                        <Metric label="Page" value={String(chunk.pageNumber)} />
                      </div>
                      <div className="bg-slate-950 rounded-md p-3">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{chunk.text}</pre>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Rejected */}
          {result.rejectedChunks?.length > 0 && (
            <div>
              <button
                onClick={() => setShowRejected(!showRejected)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
              >
                {showRejected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {result.rejectedChunks.length} chunks rejected
              </button>
              {showRejected && (
                <div className="space-y-1 animate-fade-in">
                  {result.rejectedChunks.map(r => (
                    <div key={r.chunkId} className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-900/50 opacity-70">
                      <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border', scoreColor(r.score))}>{r.score.toFixed(3)}</span>
                      <span className="text-xs text-slate-500 font-mono truncate">{r.chunkId}</span>
                      <span className="text-xs text-slate-600 truncate ml-auto">{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Enter a query to explore retrieval</p>
            <p className="text-xs mt-1 text-slate-600">Or pick an example above</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-950 rounded-md py-2 text-center border border-slate-800">
      <div className={cn('text-sm font-mono font-medium', highlight ? 'text-emerald-400' : 'text-white')}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
