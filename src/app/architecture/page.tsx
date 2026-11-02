import { ArrowDown, FileText, Database, Layers, FileEdit, GitBranch, Shield, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ArchitecturePage() {
  return (
    <div className="px-8 py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Architecture</h1>
        <p className="text-sm text-slate-500 mt-1">End-to-end pipeline from raw documents to learned, grounded drafts</p>
      </div>

      {/* Pipeline */}
      <div className="space-y-2">
        {STAGES.map((stage, i) => (
          <div key={stage.name}>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <stage.icon className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-slate-500">STAGE {String(i + 1).padStart(2, '0')}</span>
                        {stage.pts && <Badge variant="info">{stage.pts}</Badge>}
                      </div>
                      <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                  {stage.bullets.map(b => (
                    <div key={b} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {stage.tech.map(t => (
                    <code key={t} className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">{t}</code>
                  ))}
                </div>
              </CardContent>
            </Card>
            {i < STAGES.length - 1 && (
              <div className="flex flex-col items-center my-1.5 gap-0.5">
                <ArrowDown className="w-4 h-4 text-slate-600" />
                <span className="text-[10px] text-slate-500 font-mono">{stage.output}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data flow */}
      <Card>
        <CardHeader><CardTitle>Data Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="font-mono text-xs space-y-1 bg-slate-950 rounded-md p-4 border border-slate-800">
            {[
              { path: 'data/samples/input/', desc: 'Raw PDFs, TXTs, images' },
              { path: 'data/processed/', desc: 'ProcessedDocument JSON (text + structured fields)' },
              { path: 'data/index/', desc: 'Vector index (TF-IDF embeddings + cosine search)' },
              { path: 'data/edits/', desc: 'EditEvent records (original ↔ edited sections)' },
              { path: 'data/patterns.sqlite', desc: 'CorrectionPattern store (count + recency)' },
              { path: 'data/samples/output/', desc: 'Generated draft JSON + Markdown' },
            ].map(({ path, desc }) => (
              <div key={path} className="flex gap-3">
                <span className="text-slate-300 shrink-0">{path}</span>
                <span className="text-slate-600">←</span>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Differentiators */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">What makes this different</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIFFERENTIATORS.map(d => (
            <Card key={d.title}>
              <CardContent className="py-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <d.icon className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{d.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{d.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stack */}
      <Card>
        <CardHeader><CardTitle>Stack</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STACK.map(({ label, items }) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">{label}</div>
                <div className="space-y-1">
                  {items.map(item => <div key={item} className="text-xs text-slate-300">{item}</div>)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const STAGES = [
  {
    name: 'Document Processing',
    desc: 'Ingest messy legal documents in any format',
    pts: '25pts',
    icon: FileText,
    bullets: [
      'PDF native text extraction',
      'Tesseract OCR + sharp preprocessing',
      'Confidence scoring & unclear-span flagging',
      'Regex + LLM structured field extraction',
    ],
    tech: ['pdf-parse', 'tesseract.js', 'sharp', 'claude-sonnet-4-6'],
    output: 'ProcessedDocument JSON',
  },
  {
    name: 'Chunking & Indexing',
    desc: 'Split into retrievable units and embed',
    pts: '',
    icon: Layers,
    bullets: [
      'Sentence-aware chunking (400 tokens)',
      '80-token overlap for context',
      'TF-IDF local embeddings (offline)',
      'File-based JSON vector store',
    ],
    tech: ['cosine-similarity', 'TF-IDF', 'vectra-style'],
    output: 'Embedded Chunk index',
  },
  {
    name: 'Multi-Query Retrieval',
    desc: 'Surface relevant evidence with diversity',
    pts: '25pts',
    icon: Search,
    bullets: [
      '8 specialized queries per draft',
      'Scores merged (max per chunk)',
      'MMR diversity reranking (λ=0.6)',
      'Top-16 chunks fed to LLM context',
    ],
    tech: ['multi-query', 'MMR', 'cosine-search'],
    output: 'ScoredChunk[] evidence',
  },
  {
    name: 'Grounded Draft Generation',
    desc: 'LLM produces structured output with citations',
    pts: '10pts',
    icon: FileEdit,
    bullets: [
      '7-section case fact structure',
      'Every bullet cites chunkId + verbatim quote',
      '"Not stated in documents" guard',
      'Post-generation unsupported-claim check',
    ],
    tech: ['claude-sonnet-4-6', 'prompt-engineering', 'grounding'],
    output: 'CaseFactsDraft JSON + Markdown',
  },
  {
    name: 'Operator Review & Learning',
    desc: 'Learn reusable patterns from every correction',
    pts: '25pts',
    icon: GitBranch,
    bullets: [
      'EditEvent captures section diffs',
      'Claude analyzes edits → extracts rules',
      'SQLite pattern store (count + recency ranked)',
      'Patterns injected into next system prompt',
    ],
    tech: ['better-sqlite3', 'editAnalyzer', 'promptAugment'],
    output: 'Improved future drafts',
  },
];

const DIFFERENTIATORS = [
  {
    title: 'Evidence Trace',
    desc: 'Every draft bullet links to the specific chunk + verbatim quote that supports it.',
    icon: Database,
  },
  {
    title: 'Hallucination Guard',
    desc: 'Post-generation check verifies all named entities appear in retrieved chunks. Unsupported claims are flagged.',
    icon: Shield,
  },
  {
    title: 'Real Learning Loop',
    desc: 'Claude semantically analyzes operator edits to extract generalizable correction rules stored in SQLite.',
    icon: GitBranch,
  },
  {
    title: 'Retrieval Debugger',
    desc: 'See all queries, scored chunks, MMR-rejected candidates, and the exact context fed to the LLM.',
    icon: Search,
  },
];

const STACK = [
  { label: 'Runtime', items: ['Node.js 20+', 'TypeScript 5', 'tsx (dev)'] },
  { label: 'AI', items: ['Claude sonnet-4-6', 'Anthropic SDK', 'TF-IDF (local)'] },
  { label: 'Storage', items: ['File-based JSON', 'SQLite (patterns)', 'cosine search'] },
  { label: 'Frontend', items: ['Next.js 15', 'Tailwind CSS', 'Recharts', 'Radix UI'] },
];
