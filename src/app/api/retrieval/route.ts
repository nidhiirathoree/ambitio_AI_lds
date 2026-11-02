import '@/lib/backend-init';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query, caseId, topK = 12 } = await req.json();
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

    const { searchMultiQuery, search } = await import('@backend/retrieval/vectorStore');

    const multiQueries = [
      query,
      `legal context: ${query}`,
      `case facts: ${query}`,
    ];

    const results = await searchMultiQuery(multiQueries, caseId, topK);
    const allResults = await search(query, caseId, 20);

    return NextResponse.json({
      query,
      caseId,
      chunks: results,
      totalConsidered: allResults.length,
      topK,
      rejectedChunks: allResults.slice(topK).map(r => ({
        chunkId: r.chunk.chunkId,
        score: r.score,
        reason: 'Below top-K threshold or removed by MMR diversity filter',
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
