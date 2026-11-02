import * as fs from 'fs';
import * as path from 'path';
import { listProcessedDocuments } from '../processing/ingestPipeline';
import { listDrafts } from '../generation/draftGenerator';
import { generateDraft } from '../generation/draftGenerator';
import { analyzeEdits } from '../learning/editAnalyzer';
import { upsertPatterns, getPatternStats } from '../learning/patternStore';
import { loadEditEvents, captureEdit } from '../learning/editCapture';
import {
  computeExtractionUsability,
  computeRetrievalAtK,
  computeGroundingRate,
  computeEditLoopGain,
  printMetricsTable,
} from './metrics';
import { EvalMetrics, CaseFactsDraft } from '../types';
import { config, resolveDataPath } from '../config';

// Gold facts for retrieval@k evaluation
const GOLD_FACTS = [
  'plaintiff filed complaint',
  'defendant motion to dismiss',
  'damages sought',
  'court jurisdiction',
  'contract breach allegation',
  'filing date',
];

async function runFullEval(): Promise<void> {
  console.log('\n🔬 Running Ambitio Legal Drafts — Full Evaluation\n');

  // 1. Check that sample data is ingested
  let docs = listProcessedDocuments();
  if (docs.length === 0) {
    console.log('No processed documents found. Running ingest first...\n');
    const { ingestFolder } = await import('../processing/ingestPipeline');
    await ingestFolder(resolveDataPath(config.data.samplesInputDir));
    docs = listProcessedDocuments();
  }

  if (docs.length === 0) {
    console.error('No documents to evaluate. Add sample files to data/samples/input/');
    process.exit(1);
  }

  console.log(`Evaluating ${docs.length} document(s)\n`);

  // 2. Extraction usability
  const extractionMetrics = computeExtractionUsability(docs);

  // 3. Generate V1 draft for first case
  const caseId = docs[0].caseId || 'sample-001';
  console.log(`\nGenerating V1 draft for case: ${caseId}`);
  const v1Draft = await generateDraft(caseId);

  // 4. Retrieval@K — load actual chunk texts from index
  const { getChunkById } = await import('../retrieval/vectorStore');
  const allChunks = v1Draft.retrievedChunks.map(id => {
    const chunk = getChunkById(id, caseId);
    return { chunkId: id, text: chunk?.text || '' };
  });
  const retrievalMetrics = computeRetrievalAtK(v1Draft.retrievedChunks, GOLD_FACTS, allChunks, 10);

  // 5. Grounding
  const groundingMetrics = computeGroundingRate(v1Draft);

  // 6. Simulate operator edit → learn → V2 draft
  console.log('\nSimulating operator edit to demonstrate learning...');
  const goldEdit = buildGoldEdit(v1Draft);
  const editEvent = captureEdit(v1Draft, goldEdit);

  const allEvents = loadEditEvents('case_facts');
  const { patterns, summary } = await analyzeEdits(allEvents);
  upsertPatterns(patterns);
  console.log(`Patterns learned: ${summary}`);

  // Generate V2 draft
  console.log('\nGenerating V2 draft (with learned patterns)...');
  const v2Draft = await generateDraft(caseId);

  // 7. Edit loop gain
  const editLoopMetrics = computeEditLoopGain(v1Draft, v2Draft, goldEdit);

  const metrics: EvalMetrics = {
    extractionUsability: extractionMetrics,
    retrievalAtK: retrievalMetrics,
    groundingRate: groundingMetrics,
    editLoopGain: editLoopMetrics,
  };

  printMetricsTable(metrics);

  // 8. Save results
  const resultsPath = resolveDataPath('./data/eval_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ metrics, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);

  const patternStats = getPatternStats();
  console.log(`\nPattern store: ${patternStats.total} patterns (${JSON.stringify(patternStats.byType)})`);
}

function buildGoldEdit(draft: CaseFactsDraft): Record<string, string> {
  const goldEdit: Record<string, string> = {};
  for (const section of draft.sections) {
    let content = section.bullets.map((b: { text: string; citations: Array<{ chunkId: string; quote: string }> }) => `- ${b.text}`).join('\n');

    // Simulate operator improvements:
    // 1. Replace "shall" with "must"
    content = content.replace(/\bshall\b/gi, 'must');
    // 2. Add presiding judge info if missing
    if (!content.toLowerCase().includes('judge')) {
      content += '\n- Presiding judge: Not stated in documents [operator added]';
    }
    // 3. Add filing court to case overview
    if (section.heading === 'Case Overview' && !content.toLowerCase().includes('filing court')) {
      content += '\n- Filing court: To be verified from original documents [operator added]';
    }
    // 4. Add citation markers (simulate operator adding citations)
    if (!content.includes('[chunk:') && section.bullets.some((b: { citations: Array<unknown> }) => b.citations.length > 0)) {
      content += ' [operator verified citations]';
    }

    goldEdit[section.heading] = content;
  }
  return goldEdit;
}

runFullEval().catch(err => {
  console.error('Eval failed:', err);
  process.exit(1);
});
