# Assumptions and Limitations

## LLM Provider

- **Default:** Mock mode when `LLM_PROVIDER=mock` or no `LLM_API_KEY` is set.
- **Mock mode:** Uses template filler from top retrieved chunks. Demonstrates the full pipeline (ingest → index → retrieve → structure → draft → learn) without API costs. Sample outputs in `data/samples/output/` were generated in mock mode.
- **Production:** Set `LLM_PROVIDER=anthropic` + `LLM_API_KEY=sk-ant-...` for Claude-powered drafts. The system uses structured JSON prompts with strict grounding rules.

## OCR Limitations

- **`tesseract.js` on Node:** Tesseract v5 in WASM is slower and somewhat less accurate than the native binary or Python's `pytesseract`. For production with heavy scan volume, consider wrapping the Tesseract CLI instead.
- **PDF OCR:** Multi-page scanned PDFs are handled by routing through the image OCR path. For PDFs with mixed text/scan pages, only the text layer pages are extracted natively; image-only pages are OCR'd individually.
- **Confidence threshold:** Pages with < 50 chars/page are treated as potentially scanned. Confidence < 70% triggers a quality warning.
- **Preprocessing:** `sharp` applies grayscale + normalize + sharpen before Tesseract to improve accuracy on low-contrast scans.
- **Language:** English only by default. Set `TESSERACT_LANG=eng+fra` etc. for multilingual documents.

## Embeddings

- **Local TF-IDF (default):** Non-semantic — relies on keyword overlap. Adequate for legal documents which are terminology-rich. Does not capture paraphrases or synonyms well. IDF is built per-ingest-session from the document corpus.
- **OpenAI embeddings:** Full semantic search. Requires `OPENAI_API_KEY`. Set `EMBEDDING_PROVIDER=openai`.
- **Re-indexing:** If you add new documents to a case, re-run `npm run ingest` — the embedder rebuilds IDF and re-indexes.

## Sample Data

- All sample documents (`data/samples/input/`) are **fully synthetic** and created for demonstration purposes only.
- They simulate real-world messiness: OCR noise, handwritten notes, scan artifacts, inconsistent formatting, table structures.
- No real legal cases, persons, or entities are represented. Any resemblance is coincidental.
- The case "Johnson v. Acme Corporation" (Case No. 2024-CV-08472) is fictional.

## Legal Disclaimer

- This system is an **AI-assisted drafting aid only**. It is NOT legal advice.
- Generated case fact summaries must be reviewed and verified by a qualified attorney before any legal use.
- The system may miss facts, misattribute quotes, or include OCR errors. All outputs require human review.

## Edit Learning Loop

- Pattern extraction uses heuristic text analysis (not another LLM call) to keep it fast and offline-capable.
- Patterns are ranked by `count DESC, last_seen DESC` — more frequent and recent corrections are prioritized.
- The system requires at least 1-2 edit events to generate meaningful patterns. The `simulate-edits` script provides 3 scripted scenarios for immediate demonstration.
- Pattern extraction focuses on surface-level text patterns. It does not perform deep semantic analysis of edits.

## Chunking

- Chunk size ~400 tokens (estimated at ~4 chars/token). Overlap of ~80 tokens preserves context across boundaries.
- Chunking is sentence-aware: splits at sentence boundaries, not mid-sentence.
- Very short pages (< 20 chars) are skipped to avoid noise chunks.

## Vector Store

- Uses a simple JSON file store (`data/index/index_{caseId}.json`). Loads entirely in-memory for search.
- Suitable for demonstration with up to ~10,000 chunks. For production, replace with a proper vector DB (pgvector, Qdrant, Pinecone).
- MMR diversity reranking uses Jaccard token overlap as a proxy for semantic similarity (offline, no embedding cost).

## API / UI

- The Fastify API and HTML UI are bonus features. The core pipeline is fully functional via CLI.
- File upload via `POST /ingest` writes to a temp directory and cleans up after processing.
- The UI is a single-page static HTML file with no build step required.
