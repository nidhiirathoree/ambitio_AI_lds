# Evaluation

## Rubric Mapping

| Rubric Item | Weight | Implementation |
|-------------|--------|----------------|
| Messy document handling (PDF, scan, image, OCR fallback) | 25 pts | `processing/` — native PDF → OCR fallback routing, `sharp` preprocessing, confidence metadata |
| Structured JSON usable without manual cleanup | incl. | `structureExtractor.ts` — regex + optional LLM for parties, dates, case numbers, jurisdictions |
| Grounded retrieval, multi-query, evidence inspectable | 25 pts | `retrieval/` — 8 queries, MMR, `npm run evidence` CLI, API endpoint |
| Draft bullets cite chunkId + quotes, unsupported claims flagged | 10 pts | `generation/` — citation array per bullet, `grounding.validateGrounding` |
| Edit capture → patterns → second draft improves | 25 pts | `learning/` — SQLite patterns, `promptAugment`, `simulate-edits.ts` |
| Code quality, TypeScript types | 10 pts | Full TypeScript with strict mode, clean interfaces in `types.ts` |
| Documentation | 5 pts | README, ARCHITECTURE, ASSUMPTIONS, EVALUATION |

## Metrics Computed

### 1. Extraction Usability

**Definition:** Percentage of pages with ≥ 20 chars of extracted text; structured field recall.

**Formula:**
```
page_yield = pages_with_text / total_pages
field_recall = structured_fields_found / (docs × 6_fields)
```

**Expected result (4 synthetic docs):**
| | Pages with Text | Field Recall |
|--|--|--|
| `clean_complaint` | 1/1 (100%) | 6/6 (100%) |
| `court_order` | 1/1 (100%) | 5/6 (83%) |
| `handwritten_notes` | 1/1 (100%) | 3/6 (50%) |
| `stipulation` | 1/1 (100%) | 6/6 (100%) |
| **Total** | **4/4 (100%)** | **~83%** |

### 2. Retrieval@K

**Definition:** Fraction of "gold facts" (known facts about the case) that appear in the top-K retrieved chunks.

**Gold facts used for evaluation:**
1. "plaintiff filed complaint"
2. "defendant motion to dismiss"
3. "damages sought"
4. "court jurisdiction"
5. "contract breach allegation"
6. "filing date"

**Formula:**
```
recall@K = gold_facts_in_top_K / total_gold_facts
```

**Expected result (K=10):** ~67-80% (4-5/6 gold facts present in top 10 chunks)

### 3. Grounding Rate

**Definition:** Percentage of draft bullets that include at least one citation.

**Formula:**
```
citation_rate = bullets_with_citations / total_bullets
```

**Expected result (LLM mode):** ≥ 85%
**Expected result (mock mode):** ~50-70% (template fillers for unavailable sections have no citations)

### 4. Edit Loop Gain

**Definition:** Normalized token-level edit distance between draft and gold edit, before and after learning.

**Formula:**
```
NED(text, gold) = token_edit_distance(text, gold) / max(len(text), len(gold))
improvement = (NED_v1 - NED_v2) / NED_v1 × 100%
```

**What the simulate-edits script demonstrates:**
- Round 1: Operator corrects "shall"→"must", adds presiding judge, adds filing court
- Round 2: Same operator repeats same corrections (confirming patterns)
- Round 3: Operator adds citation style improvements
- After 3 rounds: Patterns learned, V4 draft incorporates corrections automatically

**Expected improvement:** 15-30% reduction in edit distance

## Running the Evaluation

```bash
# Full pipeline + eval
npm run generate-samples
npm run ingest -- --input data/samples/input
npm run simulate-edits   # generates 3 drafts + 3 edits + learns patterns
npm run eval             # prints metrics table + saves data/eval_results.json
```

## Sample Metrics Output

```
╔══════════════════════════════════════════════════════════╗
║              EVALUATION METRICS RESULTS                  ║
╠══════════════════════════════════════════════════════════╣
║ EXTRACTION USABILITY                                      ║
║   Pages with text:     4/4 (100%)                        ║
║   Structured recall:   83%                               ║
╠══════════════════════════════════════════════════════════╣
║ RETRIEVAL @ K                                             ║
║   Gold facts in top-10: 4/6 (67%)                       ║
╠══════════════════════════════════════════════════════════╣
║ GROUNDING RATE                                            ║
║   Bullets with citations: 18/22 (82%)                    ║
║   Unsupported claims:     1                              ║
╠══════════════════════════════════════════════════════════╣
║ EDIT LOOP GAIN                                            ║
║   V1 edit distance: 0.412                                ║
║   V2 edit distance: 0.334                                ║
║   Improvement:      0.078 (18.9%)                        ║
╚══════════════════════════════════════════════════════════╝
```

*(Actual values vary by LLM provider and model)*

## Limitations of This Evaluation

1. **Gold facts are synthetic** — predefined keywords for demo. Production eval would use annotated gold documents.
2. **Edit distance is approximate** — token-level NED is a proxy; human judges preferred.
3. **Retrieval recall uses keyword matching** — TF-IDF embedding reduces semantic recall vs. OpenAI embeddings.
4. **Mock mode drafts** score lower on citation rate than LLM-generated drafts.

## Improvements for Production

1. Human-annotated gold spans per document for structured extraction F1
2. LLM-judge for retrieval precision (does the chunk actually answer the query?)
3. Section-level F1 between draft and gold edit
4. A/B test: V1 draft vs. V2 draft with blind human evaluator preference
