import { CaseFactsDraft, DraftSection, ScoredChunk } from '../types';

export function validateGrounding(
  draft: CaseFactsDraft,
  retrievedChunks: ScoredChunk[]
): string[] {
  const unsupportedClaims: string[] = [];
  const chunkTexts = new Map<string, string>();

  for (const { chunk } of retrievedChunks) {
    chunkTexts.set(chunk.chunkId, chunk.text.toLowerCase());
  }

  for (const section of draft.sections) {
    for (const bullet of section.bullets) {
      if (bullet.text.includes('Not stated in documents')) continue;

      // Check if cited chunks actually support the bullet
      for (const citation of bullet.citations) {
        if (!chunkTexts.has(citation.chunkId)) {
          unsupportedClaims.push(
            `Section "${section.heading}": Bullet cites unknown chunkId "${citation.chunkId}"`
          );
        }
      }

      // Check for entity names in bullet that don't appear in any chunk
      const namedEntities = extractNamedEntities(bullet.text);
      for (const entity of namedEntities) {
        const entityLower = entity.toLowerCase();
        const appearsInChunks = Array.from(chunkTexts.values()).some(text =>
          text.includes(entityLower)
        );
        if (!appearsInChunks && bullet.citations.length > 0) {
          unsupportedClaims.push(
            `Section "${section.heading}": Entity "${entity}" not found in retrieved evidence`
          );
        }
      }

      // Bullet with substantive claims but no citations
      if (bullet.citations.length === 0 && hasSubstantiveClaim(bullet.text)) {
        unsupportedClaims.push(
          `Section "${section.heading}": Bullet "${bullet.text.slice(0, 80)}..." has no citations`
        );
      }
    }
  }

  return [...new Set(unsupportedClaims)];
}

function extractNamedEntities(text: string): string[] {
  // Extract proper nouns (sequences of Title Case words or ALL CAPS words)
  const entities: string[] = [];

  // ALL CAPS words (organizations, case numbers)
  const capsWords = text.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g) || [];
  entities.push(...capsWords.filter(w => !['NOT', 'THE', 'AND', 'FOR', 'THAT', 'THIS', 'SAID', 'SUCH'].includes(w)));

  // Title case multi-word names (e.g. "John Smith", "Acme Corp")
  const titleCase = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || [];
  entities.push(...titleCase);

  return [...new Set(entities)].slice(0, 10);
}

function hasSubstantiveClaim(text: string): boolean {
  // Bullets that are just "Not stated" or structural have no substantive claim
  if (text.includes('Not stated') || text.length < 20) return false;
  // Check for factual patterns: dates, names, amounts, specific events
  return /\d{4}|\$[\d,]+|[A-Z][a-z]+\s+[A-Z][a-z]+|\b(filed|alleged|claimed|awarded|ordered|granted|denied)\b/i.test(text);
}

export function computeGroundingStats(draft: CaseFactsDraft): {
  totalBullets: number;
  bulletsWithCitations: number;
  citationRate: number;
  unsupportedCount: number;
} {
  let totalBullets = 0;
  let bulletsWithCitations = 0;

  for (const section of draft.sections) {
    for (const bullet of section.bullets) {
      totalBullets++;
      if (bullet.citations.length > 0) bulletsWithCitations++;
    }
  }

  return {
    totalBullets,
    bulletsWithCitations,
    citationRate: totalBullets > 0 ? bulletsWithCitations / totalBullets : 0,
    unsupportedCount: draft.unsupportedClaims.length,
  };
}
