// Shared types for the frontend (mirrors backend types.ts)

export interface PageData {
  pageNumber: number;
  rawText: string;
  confidence?: number;
  unclearSpans?: Array<{ start: number; end: number; reason: string }>;
}

export interface StructuredFields {
  parties?: string[];
  dates?: string[];
  caseNumbers?: string[];
  jurisdictions?: string[];
  documentType?: string;
  keyEntities?: string[];
}

export interface ProcessedDocument {
  docId: string;
  sourcePath: string;
  caseId?: string;
  pages: PageData[];
  structured: StructuredFields;
  extractionMeta: { method: 'native' | 'ocr' | 'mixed'; warnings: string[] };
}

export interface Chunk {
  chunkId: string;
  docId: string;
  caseId?: string;
  pageNumber: number;
  text: string;
  sourceQuote: string;
  tokenCount: number;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export interface Citation {
  chunkId: string;
  quote: string;
  docId?: string;
  pageNumber?: number;
}

export interface DraftBullet {
  text: string;
  citations: Citation[];
}

export interface DraftSection {
  heading: string;
  bullets: DraftBullet[];
}

export interface CaseFactsDraft {
  draftId: string;
  caseId: string;
  draftType: 'case_facts';
  version: number;
  createdAt: string;
  sections: DraftSection[];
  unsupportedClaims: string[];
  retrievedChunks: string[];
}

export interface CorrectionPattern {
  id: string;
  type: 'phrasing' | 'content' | 'structure' | 'citation' | 'section_name' | 'ordering';
  trigger: string;
  instruction: string;
  examples: Array<{ original: string; edited: string }>;
  count: number;
  lastSeen: string;
  draftType: string;
}

export interface EvidenceMapping {
  chunkId: string;
  sourceQuote: string;
  docId: string;
  pageNumber: number;
  sections: string[];
  score: number;
}

export interface EvalMetrics {
  extractionUsability: {
    pagesWithText: number;
    totalPages: number;
    percentage: number;
    structuredFieldRecall: number;
  };
  retrievalAtK: {
    k: number;
    goldFactsPresent: number;
    totalGoldFacts: number;
    recallAtK: number;
  };
  groundingRate: {
    bulletsWithCitations: number;
    totalBullets: number;
    citationRate: number;
    unsupportedClaimsCount: number;
  };
  editLoopGain: {
    v1EditDistance: number;
    v2EditDistance: number;
    improvement: number;
    improvementPercent: number;
  };
}

export interface DashboardStats {
  documentsCount: number;
  chunksCount: number;
  draftsCount: number;
  patternsCount: number;
  casesCount: number;
  avgOcrConfidence: number | null;
  avgCitationRate: number;
  llmProvider: string;
  llmAvailable: boolean;
}

export interface RetrievalResult {
  query: string;
  chunks: ScoredChunk[];
  totalConsidered: number;
  topK: number;
  caseId?: string;
}

export interface EditEvent {
  editId: string;
  draftId: string;
  caseId: string;
  draftType: string;
  originalSections: Record<string, string>;
  editedSections: Record<string, string>;
  timestamp: string;
}
