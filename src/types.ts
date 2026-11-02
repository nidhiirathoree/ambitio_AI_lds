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

export interface ExtractionMeta {
  method: 'native' | 'ocr' | 'mixed';
  warnings: string[];
}

export interface ProcessedDocument {
  docId: string;
  sourcePath: string;
  caseId?: string;
  pages: PageData[];
  structured: StructuredFields;
  extractionMeta: ExtractionMeta;
}

export interface Chunk {
  chunkId: string;
  docId: string;
  caseId?: string;
  pageNumber: number;
  text: string;
  sourceQuote: string;
  tokenCount: number;
  embedding?: number[];
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

export interface EditEvent {
  editId: string;
  draftId: string;
  caseId: string;
  draftType: 'case_facts';
  originalSections: Record<string, string>;
  editedSections: Record<string, string>;
  timestamp: string;
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
