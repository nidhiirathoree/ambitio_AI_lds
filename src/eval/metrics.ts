import { CaseFactsDraft, ProcessedDocument, EvalMetrics } from '../types';

export function computeExtractionUsability(docs: ProcessedDocument[]): EvalMetrics['extractionUsability'] {
  let totalPages = 0;
  let pagesWithText = 0;
  let fieldsFound = 0;
  const TOTAL_FIELDS = 6; // parties, dates, caseNumbers, jurisdictions, documentType, keyEntities

  for (const doc of docs) {
    for (const page of doc.pages) {
      totalPages++;
      if (page.rawText && page.rawText.trim().length >= 20) pagesWithText++;
    }

    const s = doc.structured;
    if (s.parties && s.parties.length > 0) fieldsFound++;
    if (s.dates && s.dates.length > 0) fieldsFound++;
    if (s.caseNumbers && s.caseNumbers.length > 0) fieldsFound++;
    if (s.jurisdictions && s.jurisdictions.length > 0) fieldsFound++;
    if (s.documentType) fieldsFound++;
    if (s.keyEntities && s.keyEntities.length > 0) fieldsFound++;
  }

  const totalFieldSlots = docs.length * TOTAL_FIELDS;
  return {
    pagesWithText,
    totalPages,
    percentage: totalPages > 0 ? pagesWithText / totalPages : 0,
    structuredFieldRecall: totalFieldSlots > 0 ? fieldsFound / totalFieldSlots : 0,
  };
}

export function computeRetrievalAtK(
  retrievedChunkIds: string[],
  goldFacts: string[],
  allChunks: Array<{ chunkId: string; text: string }>,
  k = 10
): EvalMetrics['retrievalAtK'] {
  const topK = retrievedChunkIds.slice(0, k);
  const topKTexts = topK
    .map(id => allChunks.find(c => c.chunkId === id)?.text || '')
    .join(' ')
    .toLowerCase();

  let goldFactsPresent = 0;
  for (const fact of goldFacts) {
    const factWords = fact.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matches = factWords.filter(w => topKTexts.includes(w));
    if (matches.length / Math.max(factWords.length, 1) > 0.5) goldFactsPresent++;
  }

  return {
    k,
    goldFactsPresent,
    totalGoldFacts: goldFacts.length,
    recallAtK: goldFacts.length > 0 ? goldFactsPresent / goldFacts.length : 0,
  };
}

export function computeGroundingRate(draft: CaseFactsDraft): EvalMetrics['groundingRate'] {
  let totalBullets = 0;
  let bulletsWithCitations = 0;

  for (const section of draft.sections) {
    for (const bullet of section.bullets) {
      totalBullets++;
      if (bullet.citations.length > 0) bulletsWithCitations++;
    }
  }

  return {
    bulletsWithCitations,
    totalBullets,
    citationRate: totalBullets > 0 ? bulletsWithCitations / totalBullets : 0,
    unsupportedClaimsCount: draft.unsupportedClaims.length,
  };
}

export function computeEditLoopGain(
  v1Draft: CaseFactsDraft,
  v2Draft: CaseFactsDraft,
  goldSections: Record<string, string>
): EvalMetrics['editLoopGain'] {
  const v1Text = draftToText(v1Draft);
  const v2Text = draftToText(v2Draft);
  const goldText = Object.values(goldSections).join('\n');

  const v1Distance = normalizedEditDistance(v1Text, goldText);
  const v2Distance = normalizedEditDistance(v2Text, goldText);
  const improvement = v1Distance - v2Distance;

  return {
    v1EditDistance: v1Distance,
    v2EditDistance: v2Distance,
    improvement,
    improvementPercent: v1Distance > 0 ? (improvement / v1Distance) * 100 : 0,
  };
}

function draftToText(draft: CaseFactsDraft): string {
  return draft.sections
    .map(s => `${s.heading}\n${s.bullets.map(b => b.text).join('\n')}`)
    .join('\n\n');
}

function normalizedEditDistance(a: string, b: string): number {
  // Token-based edit distance (more meaningful than char-level)
  const tokensA = a.toLowerCase().split(/\s+/);
  const tokensB = b.toLowerCase().split(/\s+/);

  const m = tokensA.length;
  const n = tokensB.length;

  if (m === 0 || n === 0) return 1;

  // Limit to avoid O(n^2) on large texts
  const maxLen = 200;
  const ta = tokensA.slice(0, maxLen);
  const tb = tokensB.slice(0, maxLen);

  const dp: number[][] = Array.from({ length: ta.length + 1 }, (_, i) =>
    Array.from({ length: tb.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= ta.length; i++) {
    for (let j = 1; j <= tb.length; j++) {
      dp[i][j] = ta[i - 1] === tb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[ta.length][tb.length] / Math.max(ta.length, tb.length);
}

export function printMetricsTable(metrics: EvalMetrics): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              EVALUATION METRICS RESULTS                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');

  const { extractionUsability: eu, retrievalAtK: rk, groundingRate: gr, editLoopGain: eg } = metrics;

  console.log('║ EXTRACTION USABILITY                                      ║');
  console.log(`║   Pages with text:     ${eu.pagesWithText}/${eu.totalPages} (${(eu.percentage * 100).toFixed(0)}%)`.padEnd(61) + '║');
  console.log(`║   Structured recall:   ${(eu.structuredFieldRecall * 100).toFixed(0)}%`.padEnd(61) + '║');

  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║ RETRIEVAL @ K                                             ║');
  console.log(`║   Gold facts in top-${rk.k}: ${rk.goldFactsPresent}/${rk.totalGoldFacts} (${(rk.recallAtK * 100).toFixed(0)}%)`.padEnd(61) + '║');

  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║ GROUNDING RATE                                            ║');
  console.log(`║   Bullets with citations: ${gr.bulletsWithCitations}/${gr.totalBullets} (${(gr.citationRate * 100).toFixed(0)}%)`.padEnd(61) + '║');
  console.log(`║   Unsupported claims:     ${gr.unsupportedClaimsCount}`.padEnd(61) + '║');

  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║ EDIT LOOP GAIN                                            ║');
  console.log(`║   V1 edit distance: ${eg.v1EditDistance.toFixed(3)}`.padEnd(61) + '║');
  console.log(`║   V2 edit distance: ${eg.v2EditDistance.toFixed(3)}`.padEnd(61) + '║');
  console.log(`║   Improvement:      ${eg.improvement.toFixed(3)} (${eg.improvementPercent.toFixed(1)}%)`.padEnd(61) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}
