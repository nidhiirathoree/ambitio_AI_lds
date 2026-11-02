import '@/lib/backend-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const caseId = req.nextUrl.searchParams.get('caseId') || undefined;
    const { listDrafts } = await import('@backend/generation/draftGenerator');
    const drafts = listDrafts(caseId);
    return NextResponse.json({ drafts });
  } catch (e) {
    return NextResponse.json({ drafts: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caseId } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    const { generateDraft } = await import('@backend/generation/draftGenerator');
    const draft = await generateDraft(caseId);
    return NextResponse.json({ success: true, draft });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
