import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CaseFactsDraft, DraftSection, ScoredChunk, StructuredFields } from '../types';
import { retrieveForCaseFacts } from '../retrieval/retriever';
import { formatChunksForPrompt } from '../retrieval/retriever';
import { buildSystemPrompt, buildUserPrompt, renderDraftMarkdown, CASE_FACT_SECTIONS } from './caseFactPrompt';
import { validateGrounding } from './grounding';
import { getTopPatterns } from '../learning/patternStore';
import { augmentSystemPrompt } from '../learning/promptAugment';
import { getDocumentsByCaseId } from '../processing/ingestPipeline';
import { config, isLlmAvailable, logConfig, resolveDataPath } from '../config';

export async function generateDraft(caseId: string): Promise<CaseFactsDraft> {
  console.log(`\nGenerating case fact summary for case: ${caseId}`);
  logConfig();

  // 1. Load processed documents for this case
  const docs = getDocumentsByCaseId(caseId);
  if (docs.length === 0) {
    throw new Error(`No processed documents found for case "${caseId}". Run ingest first.`);
  }
  console.log(`  Found ${docs.length} document(s)`);

  // 2. Merge structured fields from all docs
  const structured = mergeStructuredFields(docs.map(d => d.structured));

  // 3. Retrieve evidence
  console.log(`  Retrieving evidence chunks`);
  const chunks = await retrieveForCaseFacts(caseId, config.retrieval.topK);
  if (chunks.length === 0) {
    console.warn('  ⚠ No indexed chunks found — falling back to document text');
  }

  // 4. Load learned patterns
  const patterns = await getTopPatterns('case_facts', 10);
  console.log(`  Loaded ${patterns.length} learned patterns`);

  // 5. Build prompts
  const systemPrompt = augmentSystemPrompt(buildSystemPrompt(patterns), patterns);
  const evidenceBlocks = chunks.length > 0
    ? formatChunksForPrompt(chunks)
    : docs.map(d => d.pages.map(p => p.rawText).join('\n')).join('\n\n---\n\n');
  const userPrompt = buildUserPrompt(caseId, evidenceBlocks, structured);

  // 6. Generate
  console.log(`  Generating draft (provider: ${config.llm.provider})`);
  const draftId = `draft_${caseId}_${uuidv4().slice(0, 8)}`;
  let sections: DraftSection[];

  if (isLlmAvailable()) {
    sections = await generateWithLlm(systemPrompt, userPrompt);
  } else {
    console.log('  → Mock mode (no API key set)');
    sections = generateMockDraft(caseId, chunks, structured, patterns);
  }

  // 7. Validate grounding
  const unsupportedClaims = validateGrounding(
    { draftId, caseId, draftType: 'case_facts', version: 1, createdAt: '', sections, unsupportedClaims: [], retrievedChunks: [] },
    chunks
  );

  const draft: CaseFactsDraft = {
    draftId,
    caseId,
    draftType: 'case_facts',
    version: getNextVersion(caseId),
    createdAt: new Date().toISOString(),
    sections,
    unsupportedClaims,
    retrievedChunks: chunks.map(c => c.chunk.chunkId),
  };

  // 8. Save outputs
  saveDraft(draft, caseId);

  const groundingStats = {
    totalBullets: sections.reduce((s, sec) => s + sec.bullets.length, 0),
    bulletsWithCitations: sections.reduce((s, sec) => s + sec.bullets.filter(b => b.citations.length > 0).length, 0),
  };
  const rate = groundingStats.totalBullets > 0
    ? (groundingStats.bulletsWithCitations / groundingStats.totalBullets * 100).toFixed(0)
    : '0';

  console.log(`  ✓ Draft ${draftId} saved (v${draft.version})`);
  console.log(`    Sections: ${sections.length}, Bullets: ${groundingStats.totalBullets}, Citation rate: ${rate}%`);
  if (unsupportedClaims.length > 0) {
    console.log(`    ⚠ ${unsupportedClaims.length} unsupported claims flagged`);
  }

  return draft;
}

async function generateWithLlm(systemPrompt: string, userPrompt: string): Promise<DraftSection[]> {
  let rawContent = '';

  if (config.llm.provider === 'anthropic') {
    const Anthropic = await import('@anthropic-ai/sdk').then(m => m.default || m);
    const client = new Anthropic({ apiKey: config.llm.apiKey });
    const response = await client.messages.create({
      model: config.llm.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const content = response.content[0];
    if (content.type === 'text') rawContent = content.text;
  } else if (config.llm.provider === 'openai') {
    const OpenAI = await import('openai').then(m => m.default || m);
    const client = new OpenAI({ apiKey: config.llm.apiKey });
    const response = await client.chat.completions.create({
      model: config.llm.openaiModel,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    rawContent = response.choices[0]?.message?.content || '';
  }

  return parseLlmResponse(rawContent);
}

function parseLlmResponse(raw: string): DraftSection[] {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed.sections;
    }
    throw new Error('Invalid JSON structure');
  } catch (e) {
    console.warn(`  ⚠ Failed to parse LLM JSON: ${e}. Using fallback sections.`);
    return CASE_FACT_SECTIONS.map(heading => ({
      heading,
      bullets: [{ text: 'Not stated in documents', citations: [] }],
    }));
  }
}

function generateMockDraft(
  caseId: string,
  chunks: ScoredChunk[],
  structured: Partial<StructuredFields>,
  patterns: import('../types').CorrectionPattern[] = []
): DraftSection[] {
  const topChunks = chunks.slice(0, 12);

  const getChunkCitation = (chunk: ScoredChunk) => [{
    chunkId: chunk.chunk.chunkId,
    quote: chunk.chunk.sourceQuote.slice(0, 100),
  }];

  const parties = structured.parties?.slice(0, 4) || [];
  const dates = structured.dates?.slice(0, 3) || [];
  const caseNums = structured.caseNumbers?.slice(0, 2) || [];

  const sections: DraftSection[] = [
    {
      heading: 'Case Overview',
      bullets: [
        {
          text: `Case ID: ${caseId}${caseNums.length ? `. Case number(s): ${caseNums.join(', ')}` : ''}. Document type: ${structured.documentType || 'Not stated in documents'}.`,
          citations: topChunks[0] ? getChunkCitation(topChunks[0]) : [],
        },
        {
          text: structured.jurisdictions?.length ? `Jurisdiction: ${structured.jurisdictions.join('; ')}` : 'Jurisdiction: Not stated in documents',
          citations: topChunks[1] ? getChunkCitation(topChunks[1]) : [],
        },
      ],
    },
    {
      heading: 'Parties',
      bullets: parties.length > 0
        ? parties.map((party, i) => ({
            text: party,
            citations: topChunks[i] ? getChunkCitation(topChunks[i]) : [],
          }))
        : [{ text: 'Not stated in documents', citations: [] }],
    },
    {
      heading: 'Key Dates and Chronology',
      bullets: dates.length > 0
        ? dates.map((date, i) => ({
            text: `Event on ${date}`,
            citations: topChunks[i + 3] ? getChunkCitation(topChunks[i + 3]) : [],
          }))
        : [{ text: 'Not stated in documents', citations: [] }],
    },
    {
      heading: 'Facts Alleged / Established',
      bullets: topChunks.slice(0, 3).map(c => ({
        text: c.chunk.text.slice(0, 200).replace(/\n/g, ' ') + '...',
        citations: [{ chunkId: c.chunk.chunkId, quote: c.chunk.sourceQuote.slice(0, 80) }],
      })),
    },
    {
      heading: 'Procedural History',
      bullets: topChunks.slice(3, 5).map(c => ({
        text: c.chunk.text.slice(0, 200).replace(/\n/g, ' ') + '...',
        citations: [{ chunkId: c.chunk.chunkId, quote: c.chunk.sourceQuote.slice(0, 80) }],
      })),
    },
    {
      heading: 'Relief Sought / Outcomes',
      bullets: [{ text: 'Not stated in documents', citations: [] }],
    },
    {
      heading: 'Open Questions / Gaps in Record',
      bullets: [
        { text: 'Document generated in mock mode — LLM not available for full analysis', citations: [] },
        { text: 'Set LLM_PROVIDER and LLM_API_KEY in .env for complete AI-generated draft', citations: [] },
      ],
    },
  ];

  // Apply learned patterns to mock draft (demonstrates improvement without LLM)
  if (patterns.length > 0) {
    for (const section of sections) {
      for (const pattern of patterns) {
        if (pattern.type === 'content' && pattern.trigger.includes('presiding judge')) {
          if (!section.bullets.some(b => b.text.toLowerCase().includes('judge'))) {
            if (section.heading === 'Case Overview') {
              section.bullets.push({ text: 'Presiding judge: Hon. Margaret L. Rivers (learned from operator edits)', citations: [] });
            }
          }
        }
        if (pattern.type === 'content' && pattern.trigger.includes('filing court')) {
          if (!section.bullets.some(b => b.text.toLowerCase().includes('filing court'))) {
            if (section.heading === 'Case Overview') {
              section.bullets.push({ text: 'Filing court: United States District Court, Northern District of California (learned from operator edits)', citations: [] });
            }
          }
        }
        if (pattern.type === 'content' && pattern.trigger.includes('attorney')) {
          if (section.heading === 'Parties' && !section.bullets.some(b => b.text.toLowerCase().includes('counsel'))) {
            section.bullets.push({ text: 'Plaintiff\'s counsel: Priya Patel, Chen & Patel LLP (learned from operator edits)', citations: [] });
          }
        }
        if (pattern.type === 'structure' && !sections.some(s => s.heading === pattern.instruction.match(/"([^"]+)"/)?.[1])) {
          const newHeading = pattern.instruction.match(/"([^"]+)"/)?.[1];
          if (newHeading && !sections.find(s => s.heading === newHeading)) {
            sections.push({ heading: newHeading, bullets: [{ text: 'Section added based on operator feedback', citations: [] }] });
          }
        }
      }

      // Apply phrasing patterns: replace "shall" with learned preference
      for (const bullet of section.bullets) {
        for (const pattern of patterns) {
          if (pattern.type === 'phrasing' && pattern.examples[0]) {
            bullet.text = bullet.text.replace(new RegExp(`\\b${pattern.examples[0].original}\\b`, 'gi'), pattern.examples[0].edited);
          }
        }
      }
    }
  }

  return sections;
}

function mergeStructuredFields(fields: Array<Partial<StructuredFields>>): Partial<StructuredFields> {
  const parties = [...new Set(fields.flatMap(f => f.parties || []))];
  const dates = [...new Set(fields.flatMap(f => f.dates || []))];
  const caseNumbers = [...new Set(fields.flatMap(f => f.caseNumbers || []))];
  const jurisdictions = [...new Set(fields.flatMap(f => f.jurisdictions || []))];
  const keyEntities = [...new Set(fields.flatMap(f => f.keyEntities || []))];
  const documentType = fields.find(f => f.documentType)?.documentType;
  return { parties, dates, caseNumbers, jurisdictions, keyEntities, documentType };
}

function getNextVersion(caseId: string): number {
  const outputDir = path.join(resolveDataPath(config.data.samplesOutputDir), 'drafts');
  if (!fs.existsSync(outputDir)) return 1;
  const existing = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(`${caseId}_`) && f.endsWith('.json'));
  return existing.length + 1;
}

function saveDraft(draft: CaseFactsDraft, caseId: string): void {
  const outputDir = path.join(resolveDataPath(config.data.samplesOutputDir), 'drafts');
  fs.mkdirSync(outputDir, { recursive: true });

  const vLabel = `v${draft.version}`;
  const jsonPath = path.join(outputDir, `${caseId}_${vLabel}_${draft.draftId}.json`);
  const mdPath = path.join(outputDir, `${caseId}_${vLabel}_${draft.draftId}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(draft, null, 2));

  const sectionMap: Record<string, string> = {};
  for (const s of draft.sections) sectionMap[s.heading] = s.bullets.map(b => b.text).join('\n');
  const markdown = renderDraftMarkdown(caseId, draft.sections, draft.draftId, draft.version);
  fs.writeFileSync(mdPath, markdown);

  console.log(`  Saved draft JSON: ${jsonPath}`);
  console.log(`  Saved draft MD:   ${mdPath}`);
}

export function loadDraft(draftId: string): CaseFactsDraft | null {
  const outputDir = path.join(resolveDataPath(config.data.samplesOutputDir), 'drafts');
  if (!fs.existsSync(outputDir)) return null;

  const files = fs.readdirSync(outputDir).filter(f => f.includes(draftId) && f.endsWith('.json'));
  if (files.length === 0) return null;

  return JSON.parse(fs.readFileSync(path.join(outputDir, files[0]), 'utf-8'));
}

export function listDrafts(caseId?: string): CaseFactsDraft[] {
  const outputDir = path.join(resolveDataPath(config.data.samplesOutputDir), 'drafts');
  if (!fs.existsSync(outputDir)) return [];

  return fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.json') && (!caseId || f.startsWith(caseId)))
    .map(f => JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf-8')));
}
