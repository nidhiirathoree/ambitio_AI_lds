import '@/lib/backend-init';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { listProcessedDocuments } = await import('@backend/processing/ingestPipeline');
    const { listIndexedCases } = await import('@backend/retrieval/vectorStore');
    const docs = listProcessedDocuments();
    const cases = listIndexedCases();
    return NextResponse.json({ documents: docs, cases });
  } catch (e) {
    return NextResponse.json({ documents: [], cases: [], error: String(e) }, { status: 500 });
  }
}
