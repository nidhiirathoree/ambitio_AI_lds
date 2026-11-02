# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCUMENT PROCESSING                         │
│                                                                 │
│  PDF/PNG/TXT → pdfExtractor → native text (if ≥ 50 chars/page) │
│                            ↘ ocrExtractor (if text sparse)     │
│                              sharp preprocess → tesseract.js   │
│                                                                 │
│  Text → structureExtractor → regex patterns + optional LLM     │
│       → ProcessedDocument JSON (docId, pages, structured, meta)│
│                                                                 │
│  ProcessedDocument → chunker → Chunk[] (300-500 tokens each)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     GROUNDED RETRIEVAL                          │
│                                                                 │
│  Chunk[] → embedder → number[] (TF-IDF local or OpenAI)        │
│          → vectorStore.upsert → data/index/index_{caseId}.json │
│                                                                 │
│  DraftTask → 8 multi-queries → searchMultiQuery                │
│           → MMR reranking (λ=0.6) → top 16 ScoredChunk[]      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     DRAFT GENERATION                            │
│                                                                 │
│  ScoredChunk[] → formatChunksForPrompt → evidence blocks       │
│  patternStore.getTopPatterns → CorrectionPattern[]             │
│  augmentSystemPrompt → injected operator preferences           │
│                                                                 │
│  LLM (Claude/OpenAI/mock) → CaseFactsDraft JSON               │
│  grounding.validateGrounding → unsupportedClaims[]             │
│  renderDraftMarkdown → .md file                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     EDIT LEARNING LOOP                          │
│                                                                 │
│  Operator reads draft → edits sections in UI / markdown file   │
│  editCapture.captureEdit → EditEvent (originalSections,        │
│                             editedSections, timestamp)         │
│                                                                 │
│  editAnalyzer.analyzeEdits → CorrectionPattern[]               │
│  - Phrasing: "shall"→"must", word substitutions               │
│  - Content: judge name, filing court, statute refs             │
│  - Structure: new section headings, ordering                   │
│  - Citation: operator adds more [chunk:xxx] references        │
│                                                                 │
│  patternStore.upsertPatterns → SQLite (count, recency ranked)  │
│                                                                 │
│  Next generateDraft call:                                       │
│  promptAugment.augmentSystemPrompt → patterns injected         │
│  → Improved draft (fewer corrections needed)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
data/
  samples/input/           Raw files (PDF, TXT, PNG)
  processed/<docId>.json   ProcessedDocument — text + structured
  index/index_<caseId>.json  Chunk embeddings for cosine search
  edits/<editId>.json      EditEvent records
  patterns.sqlite          CorrectionPattern store
  samples/output/
    processed/             Committed example JSON
    drafts/<caseId>_v<N>_<draftId>.{json,md}  Draft outputs
```

## Module Boundaries

| Module | Reads | Writes | External |
|--------|-------|--------|----------|
| `ingestPipeline` | files | `data/processed/` | `pdf-parse`, `tesseract.js`, `sharp` |
| `vectorStore` | `data/index/` | `data/index/` | none |
| `retriever` | vectorStore | — | none |
| `draftGenerator` | processed docs, vectorStore, patternStore | `data/samples/output/drafts/` | LLM API |
| `editCapture` | drafts | `data/edits/` | none |
| `editAnalyzer` | edits | — (returns patterns) | none |
| `patternStore` | `data/patterns.sqlite` | `data/patterns.sqlite` | `better-sqlite3` |

## Retrieval Strategy

Multi-query retrieval uses 8 pre-defined queries covering different facets of case facts:
1. Parties and roles
2. Chronology of events and dates
3. Claims, allegations, and relief
4. Procedural history
5. Monetary amounts and damages
6. Court and jurisdiction
7. Legal basis and statutes
8. Evidence and witnesses

Results are merged (keeping highest score per chunkId), then MMR-reranked (λ=0.6) to balance relevance vs. diversity.

## Embedding Strategy

**Local mode (default):** TF-IDF with hashing trick (512-dim). Fast, offline, no cost. Corpus built from all ingested chunks for the case; IDF weights enable semantic grouping.

**OpenAI mode:** `text-embedding-3-small` (1536-dim). Set `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY`.

Both modes use cosine similarity for search.

## Grounding Contract

Every draft bullet must:
1. Reference one or more `chunkId`s in its `citations` array
2. Use exact `quote` substrings from the cited chunk
3. Not name entities absent from retrieved chunks

`grounding.validateGrounding` enforces this post-generation and populates `unsupportedClaims[]`.
