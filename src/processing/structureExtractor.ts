import { StructuredFields } from '../types';
import { config, isLlmAvailable } from '../config';

const DATE_PATTERNS = [
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
  /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
];

const CASE_NUMBER_PATTERNS = [
  /\b(?:Case\s+No\.?|Civil\s+Action\s+No\.?|Docket\s+No\.?|No\.?)\s*:?\s*([A-Z0-9\-:]+(?:[-:][A-Z0-9]+)*)/gi,
  /\b(\d{4}[-\s]?(?:CV|CR|MC|SC|CA|AP)[-\s]?\d{4,6})\b/gi,
  /\b([A-Z]{2,}\s*-?\s*\d{4}\s*-?\s*\d{3,})\b/g,
];

const PARTY_PATTERNS = [
  /(?:Plaintiff[s]?|Claimant[s]?)[:\s,]+([^\n,;.]+)/gi,
  /(?:Defendant[s]?|Respondent[s]?)[:\s,]+([^\n,;.]+)/gi,
  /(?:Petitioner[s]?)[:\s,]+([^\n,;.]+)/gi,
  /\bv\.?\s+([A-Z][a-zA-Z\s,\.]+?)(?:\s*,|\s*\n|\s*$)/g,
  /IN THE MATTER OF[:\s]+([^\n]+)/gi,
  /(?:BETWEEN|AMONG)[:\s]+([^\n]+)/gi,
];

const JURISDICTION_PATTERNS = [
  /(?:IN THE|BEFORE THE|UNITED STATES?)\s+([A-Z][A-Z\s]+COURT[^\n]*)/gi,
  /(?:DISTRICT OF|STATE OF|COMMONWEALTH OF)\s+([A-Z][a-zA-Z\s]+)/gi,
  /(?:SUPERIOR COURT|CIRCUIT COURT|DISTRICT COURT|SUPREME COURT)[^\n]*/gi,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:County|District|Circuit))\b/g,
];

const DOC_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(COMPLAINT|PETITION)\b/i, 'Complaint/Petition'],
  [/\b(MOTION\s+(?:TO|FOR)[^\n]*)\b/i, 'Motion'],
  [/\b(ORDER[^\n]*)\b/i, 'Court Order'],
  [/\b(JUDGMENT[^\n]*)\b/i, 'Judgment'],
  [/\b(AFFIDAVIT[^\n]*)\b/i, 'Affidavit'],
  [/\b(SUBPOENA[^\n]*)\b/i, 'Subpoena'],
  [/\b(BRIEF[^\n]*)\b/i, 'Brief'],
  [/\b(NOTICE\s+(?:OF)[^\n]*)\b/i, 'Notice'],
  [/\b(SUMMONS[^\n]*)\b/i, 'Summons'],
  [/\b(DEPOSITION[^\n]*)\b/i, 'Deposition'],
];

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(v => {
    const k = v.toLowerCase().trim();
    if (seen.has(k) || k.length < 2) return false;
    seen.add(k);
    return true;
  });
}

function extractWithPatterns(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(text)) !== null) {
      const val = (m[1] || m[0]).trim().replace(/\s+/g, ' ');
      if (val.length > 1 && val.length < 200) results.push(val);
    }
  }
  return results;
}

function extractDocumentType(text: string): string | undefined {
  for (const [pat, type] of DOC_TYPE_PATTERNS) {
    if (pat.test(text)) return type;
  }
  return undefined;
}

function extractKeyEntities(text: string): string[] {
  const entities: string[] = [];
  // Proper nouns in CAPS (likely organization/person names)
  const capsWords = text.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g) || [];
  for (const w of capsWords) {
    if (w.length > 3 && !['THE', 'AND', 'FOR', 'WITH', 'THIS', 'THAT', 'FROM', 'UPON', 'INTO', 'SAID', 'SUCH', 'EACH', 'WILL', 'SHALL', 'MUST', 'DOES', 'HAVE', 'BEEN', 'WERE', 'CASE', 'COURT', 'PAGE', 'FILED', 'DATE'].includes(w)) {
      entities.push(w);
    }
  }
  // "Inc.", "LLC", "Corp." company suffixes
  const companies = text.match(/[A-Z][a-zA-Z\s]+(?:Inc\.|LLC|Corp\.|Ltd\.|L\.P\.|Co\.)/g) || [];
  return dedupe([...entities.slice(0, 20), ...companies]);
}

export async function extractStructured(fullText: string): Promise<StructuredFields> {
  const dates = dedupe(extractWithPatterns(fullText, DATE_PATTERNS));
  const caseNumbers = dedupe(extractWithPatterns(fullText, CASE_NUMBER_PATTERNS));
  const parties = dedupe(extractWithPatterns(fullText, PARTY_PATTERNS)).map(p => p.replace(/[,;.]$/, '').trim());
  const jurisdictions = dedupe(extractWithPatterns(fullText, JURISDICTION_PATTERNS));
  const documentType = extractDocumentType(fullText);
  const keyEntities = dedupe(extractKeyEntities(fullText)).slice(0, 15);

  // Optional LLM enhancement for unclear fields
  if (isLlmAvailable() && (parties.length === 0 || caseNumbers.length === 0)) {
    try {
      const llmFields = await llmExtractStructured(fullText.slice(0, 3000));
      return {
        dates: dedupe([...dates, ...(llmFields.dates || [])]),
        caseNumbers: dedupe([...caseNumbers, ...(llmFields.caseNumbers || [])]),
        parties: dedupe([...parties, ...(llmFields.parties || [])]),
        jurisdictions: dedupe([...jurisdictions, ...(llmFields.jurisdictions || [])]),
        documentType: documentType || llmFields.documentType,
        keyEntities: dedupe([...keyEntities, ...(llmFields.keyEntities || [])]).slice(0, 15),
      };
    } catch {
      // Fall through to regex results only
    }
  }

  return { dates, caseNumbers, parties, jurisdictions, documentType, keyEntities };
}

async function llmExtractStructured(text: string): Promise<Partial<StructuredFields>> {
  const systemPrompt = `You are a legal document parser. Extract structured fields from the provided text excerpt.
Return ONLY valid JSON matching this schema exactly:
{
  "parties": ["string"],
  "dates": ["string"],
  "caseNumbers": ["string"],
  "jurisdictions": ["string"],
  "documentType": "string or null",
  "keyEntities": ["string"]
}
If a field cannot be determined, use an empty array or null.`;

  if (config.llm.provider === 'anthropic') {
    const Anthropic = await import('@anthropic-ai/sdk').then(m => m.default || m);
    const client = new Anthropic({ apiKey: config.llm.apiKey });
    const response = await client.messages.create({
      model: config.llm.model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Extract structured fields from:\n\n${text}` }],
    });
    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    }
  } else if (config.llm.provider === 'openai') {
    const OpenAI = await import('openai').then(m => m.default || m);
    const client = new OpenAI({ apiKey: config.llm.apiKey });
    const response = await client.chat.completions.create({
      model: config.llm.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract structured fields from:\n\n${text}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });
    const content = response.choices[0]?.message?.content;
    if (content) return JSON.parse(content);
  }

  return {};
}
