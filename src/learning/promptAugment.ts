import { CorrectionPattern } from '../types';

export function augmentSystemPrompt(basePrompt: string, patterns: CorrectionPattern[]): string {
  if (patterns.length === 0) return basePrompt;

  const augmentation = buildPatternAugmentation(patterns);
  return `${basePrompt}\n\n${augmentation}`;
}

function buildPatternAugmentation(patterns: CorrectionPattern[]): string {
  const lines: string[] = [
    '## LEARNED OPERATOR PREFERENCES (apply these automatically)',
    `*Based on ${patterns.reduce((s, p) => s + p.count, 0)} past operator corrections:*`,
    '',
  ];

  // Group by type
  const byType = new Map<string, CorrectionPattern[]>();
  for (const p of patterns) {
    const arr = byType.get(p.type) || [];
    arr.push(p);
    byType.set(p.type, arr);
  }

  // Phrasing rules
  const phrasings = byType.get('phrasing') || [];
  if (phrasings.length > 0) {
    lines.push('### Language & Phrasing Rules');
    for (const p of phrasings) {
      lines.push(`- ${p.instruction} (corrected ${p.count}x)`);
      if (p.examples[0]) {
        lines.push(`  *Example: "${p.examples[0].original}" → "${p.examples[0].edited}"*`);
      }
    }
    lines.push('');
  }

  // Content additions
  const contents = byType.get('content') || [];
  if (contents.length > 0) {
    lines.push('### Required Content');
    for (const p of contents) {
      lines.push(`- ${p.instruction} (added ${p.count}x)`);
    }
    lines.push('');
  }

  // Structural patterns
  const structural = [...(byType.get('structure') || []), ...(byType.get('section_name') || [])];
  if (structural.length > 0) {
    lines.push('### Structure & Organization');
    for (const p of structural) {
      lines.push(`- ${p.instruction} (applied ${p.count}x)`);
    }
    lines.push('');
  }

  // Citation patterns
  const citations = byType.get('citation') || [];
  if (citations.length > 0) {
    lines.push('### Citation Requirements');
    for (const p of citations) {
      lines.push(`- ${p.instruction}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function shouldApplyPattern(pattern: CorrectionPattern, context: string): boolean {
  // Simple trigger matching
  if (pattern.trigger.startsWith('Contains "')) {
    const term = pattern.trigger.match(/Contains "([^"]+)"/)?.[1];
    if (term) return context.toLowerCase().includes(term.toLowerCase());
  }

  if (pattern.trigger.startsWith('Missing ')) {
    const topic = pattern.trigger.match(/Missing (?:section |information about )"([^"]+)"/)?.[1];
    if (topic) return !context.toLowerCase().includes(topic.toLowerCase());
  }

  return true;
}
