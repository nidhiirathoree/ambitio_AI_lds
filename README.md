# Ambitio Legal Drafts

**AI-powered legal document workflow** — ingest messy documents, extract structured content, retrieve grounded evidence, generate case fact summaries with citations, and improve future drafts from operator edits.

Built with TypeScript/Node.js + Claude (Anthropic) + local TF-IDF retrieval.

---

## Quick Start — UI (Recommended)

```bash
# 1. Install backend + web deps
npm install && npm run web:install

# 2. Configure API key
cp .env.example .env
# Edit .env: LLM_API_KEY=sk-ant-...

# 3. Generate sample data
npm run generate-samples
npm run ingest -- --input data/samples/input
npm run simulate-edits   # optional: pre-load edit history

# 4. Start UI (Next.js on :3001) in one terminal, backend optional
npm run web:dev

# OR start both backend API + UI together:
npm run dev:full          # API :3000 + UI :3001
```

**Then open [http://localhost:3001](http://localhost:3001)** and click **One-click Demo** to see the full pipeline.

---

## Quick Start — CLI only

```bash
# 1. Install
npm install

# 2. Configure (add your Anthropic API key)
cp .env.example .env
# Open .env and set:
#   LLM_API_KEY=sk-ant-api03-...
#   LLM_PROVIDER=anthropic

# 3. Generate synthetic sample documents
npm run generate-samples

# 4. Ingest documents (extract text, structure, chunk, index)
npm run ingest -- --input data/samples/input

# 5. Generate a case fact summary draft
npm run draft -- --case sample-001

# 6. Inspect which evidence supports which part of the draft
npm run evidence -- --draft <draftId printed in step 5>

# 7. Run the full edit-loop demo (3 operator edits → learn patterns → improved draft)
npm run simulate-edits

# 8. Run evaluation and see metrics table
npm run eval

# 9. (Optional) Start API + UI
npm run serve
# → open http://localhost:3000/ui
```

---

## Environment Variables

Edit `.env` (copy from `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | Yes | `anthropic` (recommended) \| `openai` \| `mock` |
| `LLM_API_KEY` | Yes for LLM | Anthropic API key (`sk-ant-...`) |
| `LLM_MODEL` | No | Default: `claude-sonnet-4-6` |
| `EMBEDDING_PROVIDER` | No | `local` (TF-IDF, no cost) or `openai` |
| `OPENAI_API_KEY` | Only for OpenAI | OpenAI key |
| `TESSERACT_LANG` | No | Default: `eng` |
| `PORT` | No | API server port, default `3000` |

**Without an API key:** the system runs in mock mode — the full pipeline (ingest → chunk → retrieve → structure → edit loop) is demonstrated, but draft text is template-filled rather than LLM-generated. Sample committed outputs (`data/samples/output/`) show real LLM-generated results.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run generate-samples` | Create 4 synthetic messy legal docs in `data/samples/input/` |
| `npm run ingest -- --input <path>` | Ingest file or folder (PDF/PNG/TXT); auto-routes to OCR if needed |
| `npm run draft -- --case <id>` | Generate case fact summary with grounded citations |
| `npm run evidence -- --draft <id>` | Show which chunks support which draft bullets |
| `npm run submit-edit -- --draft <id> --file <md>` | Capture operator edit → update learned patterns |
| `npm run simulate-edits` | Run 3 scripted operator edits → learn → generate improved draft |
| `npm run eval` | Print evaluation metrics table |
| `npm run serve` | Start Fastify API on port 3000 + serve UI at `/ui` |
| `npx tsx src/index.ts list` | List all documents, cases, drafts |
| `npx tsx src/index.ts patterns` | Show learned correction patterns |

---

## How It Works

### 1. Document Processing

- **PDF:** native text extraction via `pdf-parse`; if page yield < 50 chars, routes to OCR
- **Images / scanned PDFs:** `sharp` preprocess (grayscale + normalize + sharpen) → `tesseract.js`
- **OCR quality:** per-word confidence tracked; unclear spans flagged in output JSON
- **Structured extraction:** regex patterns for dates, case numbers, parties, jurisdictions + optional LLM call for ambiguous fields
- Output: `ProcessedDocument` JSON per file (pages, structured fields, extraction metadata)

### 2. Grounded Retrieval

- Sentence-aware chunking (~400 tokens, 80-token overlap)
- Embeddings: local TF-IDF hashing (default, offline) or OpenAI `text-embedding-3-small`
- File-based vector store with cosine similarity search
- **Multi-query retrieval:** 8 specialized queries covering parties, dates, claims, procedure, amounts, court, statutes, evidence — merged and MMR-reranked for diversity
- Every draft bullet must reference specific `chunkId`(s) from this retrieval

### 3. Draft Generation (Case Fact Summary)

- 7-section structured output: Case Overview → Parties → Dates → Facts → Procedure → Relief → Open Questions
- Each bullet: `text` + `citations: [{chunkId, quote}]`
- Strict grounding prompt: Claude is instructed to write "Not stated in provided documents" for anything not in evidence
- Post-generation check: entity names in draft are verified against chunk text; unsupported claims flagged

### 4. Improvement from Operator Edits

This is the most important part — **a real learning loop, not a diff viewer**:

1. **Capture:** `editCapture.ts` saves `{originalSections, editedSections}` per draft
2. **Analyze:** `editAnalyzer.ts` — **Claude analyzes the edits** and extracts reusable rules (e.g. "always include presiding judge", "replace 'shall' with 'must'", "add statutory reference"). Falls back to heuristic analysis if no API key.
3. **Store:** `patternStore.ts` — SQLite table, ranked by frequency + recency
4. **Augment:** `promptAugment.ts` — top patterns injected into the next draft's system prompt as explicit operator preferences with few-shot examples
5. **Result:** V2 draft proactively includes information the operator had to add in V1

---

## Sample Outputs

Committed in `data/samples/output/`:

| File | Description |
|------|-------------|
| `processed/sample-001_clean_complaint.json` | Extracted `ProcessedDocument` from clean complaint text |
| `processed/sample-001_court_order.json` | Extracted doc from noisy scanned order (OCR, confidence flags) |
| `drafts/sample-001_v1_draft.md` | First draft — no learned patterns |
| `drafts/sample-001_v2_after_learning.md` | Second draft — 6 patterns applied; adds judge, counsel, dates, statutes |

---

## Evaluation Results

Run `npm run eval` to reproduce. Sample run (synthetic documents, mock mode):

| Metric | Value |
|--------|-------|
| Pages with extractable text | 4/4 (100%) |
| Structured field recall | ~83% |
| Retrieval@10 (gold fact recall) | 67% |
| Draft citation rate | 82% |
| Unsupported claims (V1) | 2 |
| Edit-loop improvement | V2 has 2 more bullets pre-populated from learned patterns |

With real Claude API: citation rate rises to ~95%, draft quality significantly higher, edit-loop improvement clearly visible in edit-distance metrics.

---

## Project Structure

```
src/
  index.ts              CLI entry
  config.ts             Env config with auto-detection
  types.ts              All TypeScript interfaces
  processing/
    ingestPipeline.ts   Orchestrator: route → extract → structure → chunk+index
    pdfExtractor.ts     Native PDF text extraction
    ocrExtractor.ts     Tesseract OCR with sharp preprocessing
    structureExtractor.ts  Regex + optional LLM structured field extraction
    quality.ts          OCR confidence assessment
  retrieval/
    chunker.ts          Sentence-aware chunker with overlap
    embedder.ts         Local TF-IDF or OpenAI embeddings
    vectorStore.ts      File-based cosine similarity store
    retriever.ts        Multi-query + MMR reranking
  generation/
    caseFactPrompt.ts   Prompt templates + markdown renderer
    draftGenerator.ts   LLM orchestration + mock fallback
    grounding.ts        Post-generation unsupported-claim detection
  learning/
    editCapture.ts      Persist operator edits as EditEvent JSON
    editAnalyzer.ts     LLM + heuristic pattern extraction
    patternStore.ts     SQLite pattern store (count + recency ranked)
    promptAugment.ts    Inject learned patterns into future prompts
  api/server.ts         Fastify REST API (optional)
  eval/
    metrics.ts          Metric computation functions
    runEval.ts          Full eval runner
scripts/
  generate-samples.ts   Create 4 synthetic legal docs
  simulate-edits.ts     3 scripted operator edits for demo
public/index.html       Operator review UI (single-page)
data/samples/           Input docs + committed sample outputs
docs/                   ARCHITECTURE.md, ASSUMPTIONS.md, EVALUATION.md
```

---

## API Endpoints (optional, `npm run serve`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cases` | List cases and documents |
| `POST` | `/ingest` | Upload file → process |
| `POST` | `/cases/:id/draft` | Generate draft |
| `GET` | `/cases/:id/draft/:draftId` | Fetch draft JSON |
| `GET` | `/cases/:id/draft/:draftId/evidence` | Inspect grounding |
| `PUT` | `/cases/:id/draft/:draftId` | Submit operator edit → learn |
| `GET` | `/patterns` | List learned patterns |
| `GET` | `/ui` | Operator review UI |
