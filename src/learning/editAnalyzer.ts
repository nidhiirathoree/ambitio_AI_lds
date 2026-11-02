import { v4 as uuidv4 } from 'uuid';
import { EditEvent, CorrectionPattern } from '../types';
import { config, isLlmAvailable } from '../config';

interface AnalysisResult {
  patterns: CorrectionPattern[];
  summary: string;
}

// ─── LLM-powered pattern extraction ─────────────────────────────────────────

async function extractPatternsWithLlm(events: EditEvent[]): Promise<CorrectionPattern[]> {
  const systemPrompt = `You are analyzing operator edits to AI-generated legal drafts.
Your job is to extract REUSABLE correction patterns — rules that should apply to ALL future drafts of this type, not just this one document.

Focus on:
- Language preferences (e.g. "shall" → "must", formal vs plain wording)
- Information the operator consistently adds (e.g. always adds judge name, court name, counsel info)
- Structural preferences (section headings they rename, sections they add)
- Citation habits (do they add more citations? remove unsupported claims?)

Return a JSON array of patterns with this exact schema:
[
  {
    "type": "phrasing" | "content" | "structure" | "citation" | "section_name",
    "trigger": "short description of when this rule applies",
    "instruction": "clear imperative instruction for the LLM to follow",
    "examples": [{"original": "...", "edited": "..."}],
    "confidence": 0.0-1.0
  }
]

Only include patterns that are clearly reusable. Skip one-off document-specific facts.
Return only valid JSON array, no prose.`;

  const editSummaries = events.slice(0, 5).map((e, i) => {
    const diffs: string[] = [];
    for (const section of Object.keys(e.originalSections)) {
      const orig = e.originalSections[section] || '';
      const edited = e.editedSections[section] || orig;
      if (orig !== edited) {
        diffs.push(`Section "${section}":\n  BEFORE: ${orig.slice(0, 300)}\n  AFTER:  ${edited.slice(0, 300)}`);
      }
    }
    const newSections = Object.keys(e.editedSections).filter(s => !e.originalSections[s]);
    if (newSections.length > 0) {
      diffs.push(`New sections added: ${newSections.join(', ')}`);
    }
    return `Edit ${i + 1} (draftId: ${e.draftId}):\n${diffs.join('\n')}`;
  }).join('\n\n---\n\n');

  const userPrompt = `Analyze these ${events.length} operator edit(s) and extract reusable patterns:\n\n${editSummaries}`;

  try {
    let rawContent = '';

    if (config.llm.provider === 'anthropic') {
      const Anthropic = await import('@anthropic-ai/sdk').then(m => m.default || m);
      const client = new Anthropic({ apiKey: config.llm.apiKey });
      const response = await client.messages.create({
        model: config.llm.model,
        max_tokens: 1500,
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
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });
      rawContent = response.choices[0]?.message?.content || '';
    }

    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((p: {
      type: string;
      trigger: string;
      instruction: string;
      examples?: Array<{ original: string; edited: string }>;
    }) => ({
      id: uuidv4(),
      type: p.type || 'content',
      trigger: p.trigger || '',
      instruction: p.instruction || '',
      examples: p.examples || [],
      count: 1,
      lastSeen: new Date().toISOString(),
      draftType: 'case_facts',
    }));
  } catch (err) {
    console.warn(`  LLM pattern extraction failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────

const KNOWN_PHRASING_PAIRS: Array<[RegExp, string, string]> = [
  [/\bshall\b/gi, 'shall', 'must'],
  [/\bhereinafter\b/gi, 'hereinafter', 'hereafter'],
  [/\bwherein\b/gi, 'wherein', 'in which'],
  [/\bwhereas\b/gi, 'whereas', 'given that'],
  [/\bforthwith\b/gi, 'forthwith', 'immediately'],
  [/\bsaid\s+(?=\w)/gi, 'said ', 'the '],
];

const CONTENT_TOPICS = [
  { pattern: /filing\s+court|court\s+name/i, topic: 'filing court name' },
  { pattern: /judge|magistrate|justice/i, topic: 'presiding judge' },
  { pattern: /attorney|counsel|lawyer/i, topic: 'attorney/counsel information' },
  { pattern: /address|location|venue/i, topic: 'location/venue details' },
  { pattern: /statute|section\s+\d+|U\.S\.C\.|code/i, topic: 'statutory reference' },
  { pattern: /exhibit|attachment/i, topic: 'exhibit/attachment reference' },
  { pattern: /damages?|compensation|\$[\d,]+/i, topic: 'damages/monetary amount' },
];

function heuristicAnalysis(events: EditEvent[]): CorrectionPattern[] {
  const patterns: CorrectionPattern[] = [];
  const phrasingCounter = new Map<string, { count: number; examples: Array<{ original: string; edited: string }> }>();
  const contentCounter = new Map<string, { count: number; examples: string[] }>();
  const sectionRenames = new Map<string, { count: number; examples: Array<{ original: string; edited: string }> }>();
  let totalCitationAdditions = 0;

  for (const event of events) {
    // Phrasing changes
    for (const [heading, original] of Object.entries(event.originalSections)) {
      const edited = event.editedSections[heading] || '';
      for (const [pattern, from, to] of KNOWN_PHRASING_PAIRS) {
        pattern.lastIndex = 0;
        if (pattern.test(original) && !edited.match(new RegExp(`\\b${from}\\b`, 'i'))) {
          const key = `${from}→${to}`;
          const existing = phrasingCounter.get(key) || { count: 0, examples: [] };
          existing.count++;
          const origLine = original.split('\n').find(l => { pattern.lastIndex = 0; return pattern.test(l); }) || '';
          const editLine = edited.split('\n').find(l => l.includes(to)) || '';
          if (origLine && editLine) existing.examples.push({ original: origLine.trim(), edited: editLine.trim() });
          phrasingCounter.set(key, existing);
          pattern.lastIndex = 0;
        }
      }

      // Content additions
      for (const { pattern, topic } of CONTENT_TOPICS) {
        if (!pattern.test(original) && pattern.test(edited)) {
          const existing = contentCounter.get(topic) || { count: 0, examples: [] };
          existing.count++;
          const addedLine = edited.split('\n').find(l => pattern.test(l)) || '';
          if (addedLine) existing.examples.push(addedLine.trim());
          contentCounter.set(topic, existing);
        }
      }

      // Citation additions
      const origCits = (original.match(/\[chunk:[^\]]+\]/g) || []).length;
      const editCits = (edited.match(/\[chunk:[^\]]+\]/g) || []).length;
      totalCitationAdditions += Math.max(0, editCits - origCits);
    }

    // Section renames
    const origHeadings = new Set(Object.keys(event.originalSections));
    const editHeadings = new Set(Object.keys(event.editedSections));
    const removed = [...origHeadings].filter(h => !editHeadings.has(h));
    const added = [...editHeadings].filter(h => !origHeadings.has(h));
    for (const r of removed) {
      for (const a of added) {
        const origContent = event.originalSections[r] || '';
        const editContent = event.editedSections[a] || '';
        if (contentSimilarity(origContent, editContent) > 0.4) {
          const key = `${r}→${a}`;
          const existing = sectionRenames.get(key) || { count: 0, examples: [] };
          existing.count++;
          existing.examples.push({ original: r, edited: a });
          sectionRenames.set(key, existing);
        }
      }
    }

    // Newly added sections
    for (const heading of added) {
      const content = event.editedSections[heading] || '';
      if (content.trim().length > 20 && !removed.length) {
        const key = `new_section:${heading}`;
        const existing = sectionRenames.get(key) || { count: 0, examples: [] };
        existing.count++;
        sectionRenames.set(key, existing);
      }
    }
  }

  // Convert to patterns
  for (const [key, data] of phrasingCounter) {
    const [from, to] = key.split('→');
    patterns.push({
      id: uuidv4(), type: 'phrasing', trigger: `Draft contains "${from}"`,
      instruction: `Replace all occurrences of "${from}" with "${to}" — operator style preference`,
      examples: data.examples.slice(0, 3), count: data.count,
      lastSeen: new Date().toISOString(), draftType: 'case_facts',
    });
  }

  for (const [topic, data] of contentCounter) {
    patterns.push({
      id: uuidv4(), type: 'content', trigger: `Missing "${topic}" information`,
      instruction: `Always include "${topic}" in the appropriate section when inferable from evidence`,
      examples: data.examples.slice(0, 2).map(e => ({ original: '', edited: e })),
      count: data.count, lastSeen: new Date().toISOString(), draftType: 'case_facts',
    });
  }

  for (const [key, data] of sectionRenames) {
    if (key.startsWith('new_section:')) {
      const heading = key.replace('new_section:', '');
      patterns.push({
        id: uuidv4(), type: 'structure', trigger: `Missing section "${heading}"`,
        instruction: `Always include a section titled "${heading}" — operator added it in ${data.count} review(s)`,
        examples: [], count: data.count, lastSeen: new Date().toISOString(), draftType: 'case_facts',
      });
    } else {
      const [from, to] = key.split('→');
      patterns.push({
        id: uuidv4(), type: 'section_name', trigger: `Section heading is "${from}"`,
        instruction: `Use "${to}" instead of "${from}" for this section heading`,
        examples: data.examples.slice(0, 2), count: data.count,
        lastSeen: new Date().toISOString(), draftType: 'case_facts',
      });
    }
  }

  if (totalCitationAdditions > events.length) {
    patterns.push({
      id: uuidv4(), type: 'citation', trigger: 'Bullets with missing citations',
      instruction: `Operator consistently adds citations. Every substantive bullet must include at least one [chunk:xxx] citation. Average ${(totalCitationAdditions / events.length).toFixed(1)} citations added per review.`,
      examples: [{ original: '- Plaintiff filed the complaint', edited: '- Plaintiff filed the complaint [chunk:xxx]' }],
      count: events.length, lastSeen: new Date().toISOString(), draftType: 'case_facts',
    });
  }

  return patterns;
}

function contentSimilarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wa.size === 0 && wb.size === 0) return 1;
  const intersection = new Set([...wa].filter(w => wb.has(w)));
  const union = new Set([...wa, ...wb]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeEdits(events: EditEvent[]): Promise<AnalysisResult> {
  if (events.length === 0) {
    return { patterns: [], summary: 'No edit events to analyze' };
  }

  let llmPatterns: CorrectionPattern[] = [];
  const heuristicPatterns = heuristicAnalysis(events);

  if (isLlmAvailable()) {
    console.log(`  Running LLM-powered pattern extraction on ${events.length} edit(s)...`);
    llmPatterns = await extractPatternsWithLlm(events);
    console.log(`  LLM extracted ${llmPatterns.length} pattern(s), heuristics found ${heuristicPatterns.length}`);
  }

  // Merge: LLM patterns first (richer), then heuristic patterns that don't overlap
  const allPatterns = [...llmPatterns];
  for (const hp of heuristicPatterns) {
    const alreadyCovered = llmPatterns.some(lp =>
      lp.type === hp.type && contentSimilarity(lp.instruction, hp.instruction) > 0.5
    );
    if (!alreadyCovered) allPatterns.push(hp);
  }

  const summary = `Analyzed ${events.length} edit event(s). Extracted ${allPatterns.length} reusable pattern(s): ` +
    `${allPatterns.filter(p => p.type === 'phrasing').length} phrasing, ` +
    `${allPatterns.filter(p => p.type === 'content').length} content, ` +
    `${allPatterns.filter(p => p.type === 'citation').length} citation, ` +
    `${allPatterns.filter(p => p.type === 'structure' || p.type === 'section_name').length} structural`;

  return { patterns: allPatterns, summary };
}
