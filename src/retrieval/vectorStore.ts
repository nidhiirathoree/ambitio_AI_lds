import * as fs from 'fs';
import * as path from 'path';
import { Chunk, ScoredChunk } from '../types';
import { embedText, cosineSimilarity, getLocalEmbedder } from './embedder';
import { config, resolveDataPath } from '../config';

interface StoredChunk {
  chunk: Chunk;
  embedding: number[];
}

interface VectorIndex {
  caseId?: string;
  chunks: StoredChunk[];
  updatedAt: string;
}

function getIndexPath(caseId?: string): string {
  const indexDir = resolveDataPath(config.data.indexDir);
  fs.mkdirSync(indexDir, { recursive: true });
  const name = caseId ? `index_${caseId}.json` : 'index_global.json';
  return path.join(indexDir, name);
}

function loadIndex(caseId?: string): VectorIndex {
  const indexPath = getIndexPath(caseId);
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return { caseId, chunks: [], updatedAt: new Date().toISOString() };
}

function saveIndex(index: VectorIndex, caseId?: string): void {
  const indexPath = getIndexPath(caseId);
  index.updatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

export async function indexDocument(chunks: Chunk[], caseId?: string): Promise<void> {
  if (chunks.length === 0) return;

  // Prime the local embedder with all chunk texts first
  const embedder = getLocalEmbedder();
  for (const chunk of chunks) {
    embedder.addDocument(chunk.text);
  }
  embedder.buildIdf();

  const index = loadIndex(caseId);

  // Remove existing chunks for this docId
  const docId = chunks[0].docId;
  index.chunks = index.chunks.filter(sc => sc.chunk.docId !== docId);

  // Embed and add new chunks
  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    chunk.embedding = embedding;
    index.chunks.push({ chunk, embedding });
  }

  saveIndex(index, caseId);
}

export async function search(
  query: string,
  caseId?: string,
  topK = config.retrieval.topK
): Promise<ScoredChunk[]> {
  const index = loadIndex(caseId);

  if (index.chunks.length === 0) {
    // Try global index
    const globalIndex = loadIndex(undefined);
    if (globalIndex.chunks.length === 0) return [];
    index.chunks = globalIndex.chunks;
  }

  // Rebuild embedder IDF from stored chunks if using local mode
  const embedder = getLocalEmbedder();
  if (embedder['documents'].length === 0) {
    for (const { chunk } of index.chunks) {
      embedder.addDocument(chunk.text);
    }
    embedder.buildIdf();
  }

  const queryEmbedding = await embedText(query);

  const scored = index.chunks.map(({ chunk, embedding }) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, embedding),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function searchMultiQuery(
  queries: string[],
  caseId?: string,
  topK = config.retrieval.topK
): Promise<ScoredChunk[]> {
  const allResults = new Map<string, ScoredChunk>();

  for (const query of queries) {
    const results = await search(query, caseId, topK);
    for (const result of results) {
      const existing = allResults.get(result.chunk.chunkId);
      if (!existing || result.score > existing.score) {
        allResults.set(result.chunk.chunkId, result);
      }
    }
  }

  // MMR-like diversity reranking
  return mmrRerank(Array.from(allResults.values()), topK);
}

function mmrRerank(candidates: ScoredChunk[], k: number): ScoredChunk[] {
  if (candidates.length <= k) return candidates.sort((a, b) => b.score - a.score);

  const selected: ScoredChunk[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  const lambda = 0.6;

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = candidate.score;

      let maxSim = 0;
      for (const sel of selected) {
        const sim = textSimilarity(candidate.chunk.text, sel.chunk.text);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function getChunkById(chunkId: string, caseId?: string): Chunk | null {
  const index = loadIndex(caseId);
  const found = index.chunks.find(sc => sc.chunk.chunkId === chunkId);
  if (found) return found.chunk;

  // Try global
  const global = loadIndex(undefined);
  const globalFound = global.chunks.find(sc => sc.chunk.chunkId === chunkId);
  return globalFound ? globalFound.chunk : null;
}

export function listIndexedCases(): string[] {
  const indexDir = resolveDataPath(config.data.indexDir);
  if (!fs.existsSync(indexDir)) return [];

  return fs.readdirSync(indexDir)
    .filter(f => f.startsWith('index_') && f.endsWith('.json'))
    .map(f => f.replace('index_', '').replace('.json', ''))
    .filter(id => id !== 'global');
}
