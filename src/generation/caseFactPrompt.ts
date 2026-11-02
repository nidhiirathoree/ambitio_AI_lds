import { StructuredFields, CorrectionPattern } from '../types';

export const CASE_FACT_SECTIONS = [
  'Case Overview',
  'Parties',
  'Key Dates and Chronology',
  'Facts Alleged / Established',
  'Procedural History',
  'Relief Sought / Outcomes',
  'Open Questions / Gaps in Record',
];

export function buildSystemPrompt(patterns: CorrectionPattern[]): string {
  const patternBlock = buildPatternBlock(patterns);

  return `You are a legal analyst generating structured case fact summaries from source documents.

## ABSOLUTE RULES — never violate these
1. Every bullet you write MUST be supported by one of the EVIDENCE blocks provided. No exceptions.
2. For information not found in the evidence, write exactly: "Not stated in provided documents"
3. Include the chunkId AND a verbatim quote from that chunk for every citation
4. Do not invent dates, names, amounts, or legal conclusions that are not in the evidence
5. Do not combine information from different chunks into a single synthesized fact — cite each source separately

## OUTPUT FORMAT
Return ONLY valid JSON — no preamble, no explanation, no markdown wrapper.

{
  "sections": [
    {
      "heading": "<section name>",
      "bullets": [
        {
          "text": "<bullet text>",
          "citations": [
            {
              "chunkId": "<exact chunkId from evidence block>",
              "quote": "<verbatim excerpt from that chunk, max 120 chars>"
            }
          ]
        }
      ]
    }
  ],
  "unsupportedClaims": ["<any claim you could not ground — list here>"]
}

## REQUIRED SECTIONS (produce all 7 in this order)
1. Case Overview — case number, document type, court, jurisdiction
2. Parties — full names, roles (plaintiff/defendant/petitioner/respondent), counsel if stated
3. Key Dates and Chronology — all dates found, in order, with context
4. Facts Alleged / Established — the substantive facts the documents state or allege
5. Procedural History — filings, motions, hearings, orders, rulings
6. Relief Sought / Outcomes — what relief is sought; any judgments, orders, or outcomes stated
7. Open Questions / Gaps in Record — what the documents don't resolve; unclear or conflicting info
${patternBlock}`;
}

function buildPatternBlock(patterns: CorrectionPattern[]): string {
  if (patterns.length === 0) return '';

  const lines: string[] = [
    '',
    '## OPERATOR PREFERENCES (learned from past reviews — apply automatically)',
    `Based on ${patterns.reduce((s, p) => s + p.count, 0)} operator correction(s):`,
    '',
  ];

  for (const p of patterns.slice(0, 10)) {
    lines.push(`- [${p.type.toUpperCase()}] ${p.instruction}`);
    if (p.examples[0]?.original && p.examples[0]?.edited) {
      lines.push(`  Example: "${p.examples[0].original}" → "${p.examples[0].edited}"`);
    }
  }

  return '\n' + lines.join('\n');
}

export function buildUserPrompt(
  caseId: string,
  evidenceBlocks: string,
  structured: Partial<StructuredFields>
): string {
  const knownFields = Object.entries(structured)
    .filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
    .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.join(' | ') : v}`)
    .join('\n');

  return `## CASE ID: ${caseId}

## PRE-EXTRACTED STRUCTURED FIELDS
${knownFields || '  (none extracted — work entirely from evidence blocks below)'}

## EVIDENCE BLOCKS
${evidenceBlocks}

---
Generate the case fact summary JSON now. Ground every bullet in the evidence above.`;
}

export function renderDraftMarkdown(
  caseId: string,
  sections: Array<{
    heading: string;
    bullets: Array<{ text: string; citations: Array<{ chunkId: string; quote: string }> }>;
  }>,
  draftId: string,
  version: number
): string {
  const lines: string[] = [
    `# Case Fact Summary: ${caseId}`,
    `> **Draft ID:** ${draftId} | **Version:** v${version} | **Generated:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ];

  for (const section of sections) {
    lines.push(`## ${section.heading}`);
    lines.push('');
    for (const bullet of section.bullets) {
      const citationStr = bullet.citations.length > 0
        ? `  \`[${bullet.citations.map(c => `chunk:${c.chunkId}`).join(', ')}]\``
        : '';
      lines.push(`- ${bullet.text}${citationStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
