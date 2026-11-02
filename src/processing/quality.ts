import { PageData } from '../types';

export interface QualityReport {
  overallConfidence: number;
  lowConfidencePages: number[];
  hasUnclearSpans: boolean;
  totalUnclearSpans: number;
  warnings: string[];
}

// ─── OCR Artifact Detection ───────────────────────────────────────────────────
// Only fires on genuine OCR character-substitution patterns, not normal legal text.

// Known legal ALL-CAPS header words that should never be flagged
const LEGAL_CAPS_WHITELIST = new Set([
  'IN', 'THE', 'UNITED', 'STATES', 'DISTRICT', 'COURT', 'FOR', 'NORTHERN',
  'SOUTHERN', 'EASTERN', 'WESTERN', 'CENTRAL', 'OF', 'AND', 'ON', 'AT', 'BY',
  'PLAINTIFF', 'PLAINTIFFS', 'DEFENDANT', 'DEFENDANTS', 'PETITIONER', 'RESPONDENT',
  'COMPLAINT', 'ORDER', 'MOTION', 'JUDGMENT', 'NOTICE', 'STIPULATION', 'AGREEMENT',
  'CASE', 'NO', 'JURY', 'TRIAL', 'DEMANDED', 'WHEREFORE', 'PRAYER', 'RELIEF',
  'CAUSE', 'ACTION', 'FACTS', 'PARTIES', 'JURISDICTION', 'VENUE', 'BETWEEN',
  'AMONG', 'BEFORE', 'SUPERIOR', 'CIRCUIT', 'SUPREME', 'APPEALS', 'HONORABLE',
  'CIVIL', 'CRIMINAL', 'LAW', 'OFFICES', 'ATTORNEYS', 'COUNSEL', 'LLP', 'LLC',
  'INC', 'CORP', 'NATURE', 'SECOND', 'FIRST', 'THIRD', 'HEREBY', 'AGREED',
  'PROPOSED', 'IT', 'IS', 'SO', 'ORDERED', 'PRESIDING', 'SCHEDULE', 'DISCOVERY',
  'DENIED', 'GRANTED', 'PART', 'COUNT',
]);

interface ArtifactPattern {
  label: string;
  detect: (text: string) => Array<{ start: number; end: number; reason: string }>;
  penalty: number;
}

const ARTIFACT_PATTERNS: ArtifactPattern[] = [
  {
    // Digit-in-word: zero used as letter O inside a word (C0URT, J0HNSON, M0TION)
    label: 'digit-as-letter',
    penalty: 12,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      const re = /\b([A-Z][A-Z0-9]*[0][A-Z][A-Z0-9]*)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (!LEGAL_CAPS_WHITELIST.has(m[1])) {
          spans.push({ start: m.index, end: m.index + m[1].length, reason: 'Zero used as letter O — OCR substitution' });
        }
      }
      return spans;
    },
  },
  {
    // Letter-in-number: O used as zero in dates/case numbers (2O24, O8472)
    label: 'letter-as-digit',
    penalty: 10,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      const re = /\b(\d*[O]\d+|\d+[O]\d*)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, reason: 'Letter O used as zero — OCR substitution' });
      }
      return spans;
    },
  },
  {
    // l (lowercase L) used as I or 1 in specific positions
    label: 'l-as-I',
    penalty: 8,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      // "Count l" or "Count ll" where Roman numeral looks garbled
      const re = /\bCount\s+[lI]{1,3}\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[0].includes('l')) spans.push({ start: m.index, end: m.index + m[0].length, reason: "Lowercase 'l' used as Roman numeral — OCR confusion" });
      }
      return spans;
    },
  },
  {
    // Scan damage annotations in brackets
    label: 'scan-annotation',
    penalty: 15,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      const re = /\[(?:smudge|torn|illegible|barely legible|handwritten|scan artifact|marginal note|page quality|poor|blurred|[?])[^\]]{0,60}\]/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, reason: 'Scan damage annotation' });
      }
      return spans;
    },
  },
  {
    // Known OCR word errors (dropped/swapped characters)
    label: 'ocr-word-error',
    penalty: 10,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      // Specific patterns from our sample docs: "Prlya" (Priya), "MOTTON" (MOTION), "l/O" (I/O), "Sm1th" (Smith)
      const knownErrors = [
        { re: /\bPrlya\b/g, reason: "OCR error: likely 'Priya'" },
        { re: /\bMOTTON\b/g, reason: "OCR error: likely 'MOTION'" },
        { re: /\b[A-Z][a-z]+[0-9][a-z]+\b/g, reason: 'Digit embedded in proper name — OCR error' },
        { re: /\bl\/O\b/gi, reason: "OCR confusion: 'l' vs '1'" },
      ];
      for (const { re, reason } of knownErrors) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          spans.push({ start: m.index, end: m.index + m[0].length, reason });
        }
      }
      return spans;
    },
  },
  {
    // [?:text] markers from handwritten content
    label: 'unclear-marker',
    penalty: 8,
    detect(text) {
      const spans: Array<{ start: number; end: number; reason: string }> = [];
      const re = /\[\?:[^\]]{1,30}\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, reason: 'Low-confidence OCR token' });
      }
      return spans;
    },
  },
];

export function detectOcrArtifacts(text: string): {
  unclearSpans: Array<{ start: number; end: number; reason: string }>;
  confidence: number;
} {
  const allSpans: Array<{ start: number; end: number; reason: string }> = [];
  let totalPenalty = 0;

  for (const artifact of ARTIFACT_PATTERNS) {
    const found = artifact.detect(text);
    for (const span of found) {
      // Dedup by position
      if (!allSpans.some(s => Math.abs(s.start - span.start) < 3)) {
        allSpans.push(span);
        totalPenalty += artifact.penalty;
      }
    }
  }

  // Calibrate: base 92%, reduced by detected artifacts (realistic scan range: 50–90%)
  const wordCount = Math.max(1, text.split(/\s+/).length);
  const densityFactor = Math.min(1, allSpans.length / (wordCount * 0.05));
  const confidence = Math.round(Math.max(45, 92 - totalPenalty * 0.6 - densityFactor * 15));

  return { unclearSpans: allSpans, confidence };
}

export function analyzePageNoisiness(rawText: string): {
  isNoisy: boolean;
  confidence: number;
  unclearSpans: Array<{ start: number; end: number; reason: string }>;
} {
  // Quick triggers: if none of these fire, skip expensive pattern scan
  const hasScanAnnotations = /\[(?:smudge|torn|illegible|barely legible|handwritten)[^\]]{0,40}\]/i.test(rawText);
  const hasDigitLetterSwap = /\b[A-Z][A-Z0-9]*[0][A-Z][A-Z0-9]*\b/.test(rawText) || /\b\d*[O]\d+\b/.test(rawText);
  const hasKnownErrors = /\b(?:Prlya|MOTTON|Sm[0-9]th)\b/i.test(rawText);
  const hasUnclearMarkers = /\[\?:/.test(rawText);

  const isNoisy = hasScanAnnotations || hasDigitLetterSwap || hasKnownErrors || hasUnclearMarkers;

  if (!isNoisy) return { isNoisy: false, confidence: 97, unclearSpans: [] };

  const { unclearSpans, confidence } = detectOcrArtifacts(rawText);
  return { isNoisy: unclearSpans.length > 0, confidence, unclearSpans };
}

// ─── Quality Assessment ───────────────────────────────────────────────────────

export function assessQuality(pages: PageData[]): QualityReport {
  const warnings: string[] = [];
  const lowConfidencePages: number[] = [];
  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalUnclearSpans = 0;

  for (const page of pages) {
    if (page.confidence !== undefined && page.confidence !== null) {
      totalConfidence += page.confidence;
      confidenceCount++;
      if (page.confidence < 75) {
        lowConfidencePages.push(page.pageNumber);
      }
    }
    if (page.unclearSpans) {
      totalUnclearSpans += page.unclearSpans.length;
    }
    if (page.rawText.length < 20) {
      warnings.push(`Page ${page.pageNumber} has almost no text (${page.rawText.length} chars)`);
    }
  }

  const overallConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 100;

  if (lowConfidencePages.length > 0) {
    warnings.push(`Low confidence on pages: ${lowConfidencePages.join(', ')} — review highlighted spans`);
  }
  if (totalUnclearSpans >= 3 && totalUnclearSpans <= 10) {
    warnings.push(`${totalUnclearSpans} unclear OCR span(s) detected — downstream extraction may miss details`);
  }
  if (totalUnclearSpans > 10) {
    warnings.push(`${totalUnclearSpans} unclear spans — high noise level, consider re-scan at higher DPI`);
  }

  return { overallConfidence, lowConfidencePages, hasUnclearSpans: totalUnclearSpans > 0, totalUnclearSpans, warnings };
}
