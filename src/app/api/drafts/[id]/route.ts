import '@/lib/backend-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { loadDraft } = await import('@backend/generation/draftGenerator');
    const draft = loadDraft(id);
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { loadDraft } = await import('@backend/generation/draftGenerator');
    const { captureEdit } = await import('@backend/learning/editCapture');
    const { analyzeEdits } = await import('@backend/learning/editAnalyzer');
    const { upsertPatterns } = await import('@backend/learning/patternStore');
    const { loadEditEvents } = await import('@backend/learning/editCapture');

    const draft = loadDraft(id);
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const event = captureEdit(draft, body.editedSections);
    const allEvents = loadEditEvents('case_facts');
    const { patterns, summary } = await analyzeEdits(allEvents);
    upsertPatterns(patterns);

    return NextResponse.json({ success: true, editId: event.editId, patternsLearned: patterns.length, summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
