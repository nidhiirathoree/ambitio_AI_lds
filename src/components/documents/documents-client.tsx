'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Upload, AlertTriangle, CheckCircle, Eye, Code, X, Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn, formatConfidence, confidenceColor } from '@/lib/utils';
import type { ProcessedDocument } from '@/lib/types';

export function DocumentsClient() {
  const [docs, setDocs] = useState<ProcessedDocument[]>([]);
  const [selected, setSelected] = useState<ProcessedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/documents').then(r => r.json()).catch(() => ({ documents: [] }));
    setDocs(res.documents || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleUpload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      await fetch('/api/ingest', { method: 'POST', body: form });
    }
    await load();
    setUploading(false);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  }, []);

  const filtered = docs.filter(d => !filter || d.docId.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">Inspect extracted text, structured fields, and OCR confidence</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-4">
          {/* Upload */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            className={cn(
              'rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors',
              drag ? 'border-slate-500 bg-slate-900' : 'border-slate-800 hover:border-slate-700'
            )}
          >
            <Upload className="w-5 h-5 mx-auto mb-2 text-slate-500" />
            <div className="text-sm text-slate-300">{uploading ? 'Processing…' : 'Drop files here or click'}</div>
            <div className="text-xs text-slate-500 mt-0.5">PDF · PNG · JPG · TXT</div>
            <input id="file-input" type="file" multiple accept=".pdf,.txt,.png,.jpg,.jpeg" className="hidden"
              onChange={e => e.target.files && handleUpload(e.target.files)} />
          </div>

          {/* Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…" className="pl-9" />
          </div>

          {/* List */}
          <div className="space-y-1">
            {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-14" />)}
            {!loading && filtered.map(doc => {
              const active = selected?.docId === doc.docId;
              return (
                <button
                  key={doc.docId}
                  onClick={() => setSelected(doc)}
                  className={cn(
                    'w-full text-left p-3 rounded-md transition-colors border',
                    active ? 'bg-slate-900 border-slate-700' : 'border-transparent hover:bg-slate-900/50'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{doc.docId}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant={doc.extractionMeta.method === 'native' ? 'success' : 'warning'} className="text-[10px]">
                          {doc.extractionMeta.method}
                        </Badge>
                        <span className="text-[10px] text-slate-500 font-mono">{doc.pages.length}p</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-500">
                {filter ? 'No matches' : 'No documents yet'}
              </div>
            )}
          </div>
        </aside>

        <section className="lg:col-span-8">
          {selected ? <DocDetail doc={selected} onClose={() => setSelected(null)} /> : (
            <Card>
              <CardContent className="py-20 text-center text-slate-500">
                <Eye className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a document to inspect</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function DocDetail({ doc, onClose }: { doc: ProcessedDocument; onClose: () => void }) {
  const hasOcr = doc.extractionMeta.method !== 'native';
  const avgConf = doc.pages.reduce((s, p) => s + (p.confidence ?? 100), 0) / doc.pages.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant={doc.extractionMeta.method === 'native' ? 'success' : 'warning'}>
                {doc.extractionMeta.method}
              </Badge>
              {hasOcr && <Badge variant="info">{formatConfidence(avgConf)}</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-white truncate">{doc.docId}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{doc.sourcePath}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-3.5 h-3.5" /></Button>
        </CardContent>
      </Card>

      {doc.extractionMeta.warnings.length > 0 && (
        <Card className="border-amber-500/30">
          <CardContent className="py-4 space-y-1">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Extraction warnings
            </div>
            {doc.extractionMeta.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300/80 pl-5">{w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text"><Eye className="w-3 h-3" />OCR Output</TabsTrigger>
          <TabsTrigger value="structured"><Code className="w-3 h-3" />Structured</TabsTrigger>
          {hasOcr && <TabsTrigger value="confidence">Confidence</TabsTrigger>}
        </TabsList>

        <TabsContent value="text" className="space-y-3">
          {doc.pages.map(page => (
            <Card key={page.pageNumber}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">Page {page.pageNumber}</span>
                  {page.confidence != null && (
                    <span className={cn('text-xs font-mono', confidenceColor(page.confidence))}>
                      {formatConfidence(page.confidence)}
                    </span>
                  )}
                </div>
                <AnnotatedText text={page.rawText} unclearSpans={page.unclearSpans} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="structured">
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Object.entries(doc.structured)
                  .filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
                  .map(([key, val]) => (
                    <div key={key}>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">{key}</div>
                      {Array.isArray(val) ? (
                        <div className="space-y-1">
                          {val.map((v: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="text-sm text-slate-200">{v}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="info">{String(val)}</Badge>
                      )}
                    </div>
                  ))}
              </div>
              <details className="mt-5">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">Raw JSON</summary>
                <pre className="mt-2 text-[11px] text-slate-400 bg-slate-950 rounded-md p-3 overflow-auto max-h-64">
                  {JSON.stringify(doc.structured, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </TabsContent>

        {hasOcr && (
          <TabsContent value="confidence">
            <Card>
              <CardContent className="py-4 space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-300">Overall OCR Confidence</span>
                    <span className={cn('font-mono', confidenceColor(avgConf))}>{formatConfidence(avgConf)}</span>
                  </div>
                  <Progress value={avgConf} barClassName={avgConf >= 80 ? 'bg-emerald-400' : avgConf >= 60 ? 'bg-amber-400' : 'bg-rose-400'} />
                </div>
                {doc.pages.map(page => page.unclearSpans?.map((span, i) => (
                  <div key={`${page.pageNumber}-${i}`} className="flex items-start gap-3 p-3 rounded-md bg-rose-500/5 border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-rose-300 font-medium">Page {page.pageNumber} · chars {span.start}–{span.end}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{span.reason}</p>
                      <code className="text-[11px] text-slate-500 mt-1 block truncate">
                        "…{page.rawText.slice(Math.max(0, span.start - 10), span.end + 10)}…"
                      </code>
                    </div>
                  </div>
                )))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AnnotatedText({ text, unclearSpans }: { text: string; unclearSpans?: Array<{ start: number; end: number; reason: string }> }) {
  if (!unclearSpans?.length) {
    return <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{text}</pre>;
  }
  const parts: Array<{ text: string; isUnclear: boolean; reason?: string }> = [];
  let cursor = 0;
  const sorted = [...unclearSpans].sort((a, b) => a.start - b.start);
  for (const span of sorted) {
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start), isUnclear: false });
    parts.push({ text: text.slice(span.start, span.end), isUnclear: true, reason: span.reason });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), isUnclear: false });

  return (
    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
      {parts.map((part, i) =>
        part.isUnclear ? (
          <mark key={i} className="bg-rose-500/15 text-rose-300 rounded px-0.5" title={part.reason}>{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </pre>
  );
}
