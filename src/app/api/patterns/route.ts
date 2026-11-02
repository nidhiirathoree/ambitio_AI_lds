import '@/lib/backend-init';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const draftType = req.nextUrl.searchParams.get('draftType') || 'case_facts';
    const { getTopPatterns, getPatternStats, getAllPatterns } = await import('@backend/learning/patternStore');
    const patterns = await getTopPatterns(draftType, 50);
    const all = getAllPatterns();
    const stats = getPatternStats();
    return NextResponse.json({ patterns, all, stats });
  } catch (e) {
    return NextResponse.json({ patterns: [], all: [], stats: { total: 0, byType: {} }, error: String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { clearPatterns } = await import('@backend/learning/patternStore');
    clearPatterns();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
