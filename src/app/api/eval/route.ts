import '@/lib/backend-init';
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { ROOT_DIR } from '@/lib/backend-init';

export async function GET() {
  try {
    // Try to load saved eval results first
    const resultsPath = path.join(ROOT_DIR, 'data/eval_results.json');
    if (fs.existsSync(resultsPath)) {
      const saved = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      return NextResponse.json({ ...saved, cached: true });
    }

    // Compute live metrics
    const { listProcessedDocuments } = await import('@backend/processing/ingestPipeline');
    const { listDrafts } = await import('@backend/generation/draftGenerator');
    const { getPatternStats } = await import('@backend/learning/patternStore');
    const { loadEditEvents } = await import('@backend/learning/editCapture');
    const { computeExtractionUsability, computeGroundingRate } = await import('@backend/eval/metrics');

    const docs = listProcessedDocuments();
    const drafts = listDrafts();
    const stats = getPatternStats();
    const events = loadEditEvents();

    const extractionMetrics = computeExtractionUsability(docs);

    let groundingMetrics = { bulletsWithCitations: 0, totalBullets: 0, citationRate: 0, unsupportedClaimsCount: 0 };
    if (drafts.length > 0) {
      const latest = drafts.sort((a, b) => b.version - a.version)[0];
      groundingMetrics = computeGroundingRate(latest);
    }

    return NextResponse.json({
      metrics: {
        extractionUsability: extractionMetrics,
        groundingRate: groundingMetrics,
        patternsLearned: stats.total,
        editEvents: events.length,
        patternsByType: stats.byType,
        draftsGenerated: drafts.length,
      },
      cached: false,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), metrics: null }, { status: 500 });
  }
}

export async function POST() {
  // Trigger full evaluation run
  try {
    const { listProcessedDocuments } = await import('@backend/processing/ingestPipeline');
    const { listDrafts, generateDraft } = await import('@backend/generation/draftGenerator');
    const docs = listProcessedDocuments();

    if (docs.length === 0) {
      return NextResponse.json({ error: 'No documents ingested yet' }, { status: 400 });
    }

    const caseId = docs[0].caseId || 'sample-001';
    const draft = await generateDraft(caseId);
    const { computeExtractionUsability, computeGroundingRate, computeRetrievalAtK } = await import('@backend/eval/metrics');
    const { getChunkById } = await import('@backend/retrieval/vectorStore');

    const extractionMetrics = computeExtractionUsability(docs);
    const groundingMetrics = computeGroundingRate(draft);
    const allChunks = draft.retrievedChunks.map(id => {
      const c = getChunkById(id, caseId);
      return { chunkId: id, text: c?.text || '' };
    });
    const GOLD_FACTS = ['plaintiff', 'defendant', 'damages', 'court', 'contract', 'filing'];
    const retrievalMetrics = computeRetrievalAtK(draft.retrievedChunks, GOLD_FACTS, allChunks, 10);

    const { getPatternStats } = await import('@backend/learning/patternStore');
    const stats = getPatternStats();

    const result = {
      metrics: { extractionUsability: extractionMetrics, groundingRate: groundingMetrics, retrievalAtK: retrievalMetrics, patternsLearned: stats.total, patternsByType: stats.byType },
      draftId: draft.draftId,
      timestamp: new Date().toISOString(),
    };

    const resultsPath = require('path').join(ROOT_DIR, 'data/eval_results.json');
    require('fs').writeFileSync(resultsPath, JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
