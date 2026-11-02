'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Brain, Save, CheckCircle, Lightbulb, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn, patternTypeColor } from '@/lib/utils';
import type { CaseFactsDraft, CorrectionPattern } from '@/lib/types';

export function ReviewClient() {
  const params = useSearchParams();
  const draftId = params.get('draftId');

  const [drafts, setDrafts] = useState<CaseFactsDraft[]>([]);
  const [selected, setSelected] = useState<CaseFactsDraft | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ patternsLearned: number; summary: string } | null>(null);
  const [patterns, setPatterns] = useState<CorrectionPattern[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  async function loadDrafts() {
    const res = await fetch('/api/drafts').then(r => r.json()).catch(() => ({ drafts: [] }));
    const list = (res.drafts || []).sort((a: CaseFactsDraft, b: CaseFactsDraft) => b.version - a.version);
    setDrafts(list);
    const target = draftId ? list.find((d: CaseFactsDraft) => d.draftId === draftId) : list[0];
    if (target) selectDraft(target);
  }

  async function loadPatterns() {
    const res = await fetch('/api/patterns').then(r => r.json()).catch(() => ({ patterns: [] }));
    setPatterns(res.patterns || []);
  }

  function selectDraft(draft: CaseFactsDraft) {
    setSelected(draft);
    const initial: Record<string, string> = {};
    for (const section of draft.sections) {
      initial[section.heading] = section.bullets.map(b => `- ${b.text}`).join('\n');
    }
    setEdits(initial);
    setSaved(null);
  }

  useEffect(() => { loadDrafts(); loadPatterns(); }, []);

  async function submitEdit() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/drafts/${selected.draftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedSections: edits }),
    }).then(r => r.json());
    setSaved({ patternsLearned: res.patternsLearned, summary: res.summary });
    await loadPatterns();
    setSaving(false);
  }

  const isDirty = selected
    ? selected.sections.some(s => {
        const original = s.bullets.map(b => `- ${b.text}`).join('\n');
        return edits[s.heading] !== original;
      })
    : false;

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white">Review</h1>
          <p className="text-sm text-slate-500 mt-1">Edits become reusable patterns the system applies to future drafts</p>
        </div>
        {selected && (
          <Button variant="primary" onClick={submitEdit} loading={saving} disabled={!isDirty && !saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save & Learn'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Draft picker */}
        <aside className="lg:col-span-3 space-y-1">
          <div className="text-xs text-slate-500 px-1 mb-2">Drafts</div>
          {drafts.map(d => {
            const active = selected?.draftId === d.draftId;
            return (
              <button
                key={d.draftId}
                onClick={() => selectDraft(d)}
                className={cn(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  active ? 'bg-slate-900 border-slate-700' : 'border-transparent hover:bg-slate-900/50'
                )}
              >
                <div className="text-sm text-white truncate">{d.caseId}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">v{d.version} · {new Date(d.createdAt).toLocaleDateString()}</div>
              </button>
            );
          })}
        </aside>

        {/* Editor */}
        <section className="lg:col-span-6 space-y-3">
          {selected ? (
            <>
              {saved && (
                <Card className="border-emerald-500/30">
                  <CardContent className="py-3 flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-emerald-400 font-medium">
                        Edit saved · {saved.patternsLearned} pattern{saved.patternsLearned === 1 ? '' : 's'} learned
                      </p>
                      <p className="text-xs text-emerald-400/70 mt-0.5">{saved.summary}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selected.sections.map(section => {
                const original = section.bullets.map(b => `- ${b.text}`).join('\n');
                const current = edits[section.heading] || original;
                const changed = current !== original;
                const isOpen = expandedSection === section.heading || changed;
                const hasUncited = section.bullets.some(b => b.citations.length === 0 && b.text.length > 40);

                return (
                  <div
                    key={section.heading}
                    className={cn(
                      'bg-slate-900 border rounded-lg overflow-hidden transition-colors',
                      changed ? 'border-amber-500/40' : 'border-slate-800'
                    )}
                  >
                    <button
                      onClick={() => setExpandedSection(isOpen ? null : section.heading)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{section.heading}</span>
                        {changed && <Badge variant="warning">Edited</Badge>}
                        {hasUncited && (
                          <span className="text-[10px] text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> uncited
                          </span>
                        )}
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-slate-500" />
                        : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                        <Textarea
                          value={current}
                          onChange={e => setEdits(prev => ({ ...prev, [section.heading]: e.target.value }))}
                          rows={Math.max(4, current.split('\n').length + 1)}
                          className="text-xs"
                        />
                        {changed && (
                          <button
                            onClick={() => setEdits(prev => ({ ...prev, [section.heading]: original }))}
                            className="text-xs text-slate-500 hover:text-slate-300 mt-2 transition-colors"
                          >
                            ← Revert
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-slate-500">
                <Brain className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Pick a draft to review</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Patterns */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lightbulb className="w-3.5 h-3.5" /> Learned Patterns
            </div>
            <Badge variant="ghost">{patterns.length}</Badge>
          </div>
          <div className="space-y-2">
            {patterns.map(p => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', patternTypeColor(p.type))}>
                    {p.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{p.count}×</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{p.instruction}</p>
                {p.examples[0] && (
                  <div className="mt-2 bg-slate-950 rounded p-2 text-[10px] leading-tight">
                    <div className="text-rose-400/70 line-through truncate">{p.examples[0].original || '(empty)'}</div>
                    <div className="text-emerald-400 truncate">→ {p.examples[0].edited}</div>
                  </div>
                )}
              </div>
            ))}
            {!patterns.length && (
              <Card>
                <CardContent className="py-6 text-center text-xs text-slate-500">
                  No patterns yet
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
