import { ScoredChunk, EvidenceMapping } from '../types';
import { searchMultiQuery } from './vectorStore';
import { config } from '../config';

// Multi-query strategy specific to case fact summaries
const CASE_FACT_QUERIES = [
  'parties plaintiff defendant petitioner respondent names roles',
  'chronology events dates timeline sequence of events',
  'claims allegations facts asserted relief sought damages',
  'procedural history filings motions hearings court appearances',
  'amounts monetary damages penalties fines compensation',
  'court jurisdiction venue judge tribunal',
  'legal basis cause of action statute violation',
  'evidence exhibits documents witnesses testimony',
];

export async function retrieveForCaseFacts(
  caseId: string,
  topK = config.retrieval.topK
): Promise<ScoredChunk[]> {
  return searchMultiQuery(CASE_FACT_QUERIES, caseId, topK);
}

export async function retrieveForQuery(
  query: string,
  caseId: string,
  topK = config.retrieval.topK
): Promise<ScoredChunk[]> {
  const queries = [
    query,
    `legal context: ${query}`,
    `case facts about: ${query}`,
  ];
  return searchMultiQuery(queries, caseId, topK);
}

export function buildEvidenceMappings(
  scoredChunks: ScoredChunk[],
  draftSections: Record<string, string>
): EvidenceMapping[] {
  return scoredChunks.map(({ chunk, score }) => {
    const mentionedIn: string[] = [];

    for (const [section, content] of Object.entries(draftSections)) {
      if (content.includes(chunk.chunkId) || contentOverlaps(content, chunk.text)) {
        mentionedIn.push(section);
      }
    }

    return {
      chunkId: chunk.chunkId,
      sourceQuote: chunk.sourceQuote,
      docId: chunk.docId,
      pageNumber: chunk.pageNumber,
      sections: mentionedIn,
      score,
    };
  });
}

function contentOverlaps(draftContent: string, chunkText: string): boolean {
  // Check if significant n-grams from chunk appear in draft
  const chunkWords = chunkText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const draftLower = draftContent.toLowerCase();
  let matches = 0;
  for (const word of chunkWords.slice(0, 20)) {
    if (draftLower.includes(word)) matches++;
  }
  return matches / Math.min(chunkWords.length, 20) > 0.3;
}

export function formatChunksForPrompt(chunks: ScoredChunk[]): string {
  return chunks
    .map(({ chunk, score }, i) => {
      return `[EVIDENCE ${i + 1}] (chunkId: ${chunk.chunkId}, doc: ${chunk.docId}, page: ${chunk.pageNumber}, score: ${score.toFixed(3)})\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}
