import { v4 as uuidv4 } from 'uuid';
import { ProcessedDocument, Chunk } from '../types';
import { config } from '../config';

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while preserving them
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function chunkDocument(doc: ProcessedDocument): Chunk[] {
  const chunks: Chunk[] = [];
  const { chunkSize, chunkOverlap } = config.retrieval;

  for (const page of doc.pages) {
    if (!page.rawText || page.rawText.trim().length === 0) continue;

    const sentences = splitIntoSentences(page.rawText);
    let buffer: string[] = [];
    let bufferTokens = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentTokens = estimateTokens(sentence);

      if (bufferTokens + sentTokens > chunkSize && buffer.length > 0) {
        // Emit current chunk
        const text = buffer.join(' ').trim();
        if (text.length > 20) {
          chunks.push(makeChunk(doc, page.pageNumber, text));
        }

        // Overlap: keep last few sentences
        const overlapSentences: string[] = [];
        let overlapTokens = 0;
        for (let j = buffer.length - 1; j >= 0; j--) {
          const t = estimateTokens(buffer[j]);
          if (overlapTokens + t > chunkOverlap) break;
          overlapSentences.unshift(buffer[j]);
          overlapTokens += t;
        }
        buffer = overlapSentences;
        bufferTokens = overlapTokens;
      }

      buffer.push(sentence);
      bufferTokens += sentTokens;
    }

    // Emit remainder
    if (buffer.length > 0) {
      const text = buffer.join(' ').trim();
      if (text.length > 20) {
        chunks.push(makeChunk(doc, page.pageNumber, text));
      }
    }
  }

  return chunks;
}

function makeChunk(doc: ProcessedDocument, pageNumber: number, text: string): Chunk {
  return {
    chunkId: `${doc.docId}_p${pageNumber}_${uuidv4().slice(0, 8)}`,
    docId: doc.docId,
    caseId: doc.caseId,
    pageNumber,
    text,
    sourceQuote: text.slice(0, 200),
    tokenCount: estimateTokens(text),
  };
}

export function chunkText(text: string, docId: string, pageNumber = 1, caseId?: string): Chunk[] {
  const { chunkSize, chunkOverlap } = config.retrieval;
  const chunks: Chunk[] = [];
  const sentences = splitIntoSentences(text);
  let buffer: string[] = [];
  let bufferTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);
    if (bufferTokens + sentTokens > chunkSize && buffer.length > 0) {
      const chunkText = buffer.join(' ').trim();
      if (chunkText.length > 20) {
        chunks.push({
          chunkId: `${docId}_p${pageNumber}_${uuidv4().slice(0, 8)}`,
          docId,
          caseId,
          pageNumber,
          text: chunkText,
          sourceQuote: chunkText.slice(0, 200),
          tokenCount: estimateTokens(chunkText),
        });
      }
      const overlap: string[] = [];
      let ot = 0;
      for (let j = buffer.length - 1; j >= 0; j--) {
        const t = estimateTokens(buffer[j]);
        if (ot + t > chunkOverlap) break;
        overlap.unshift(buffer[j]);
        ot += t;
      }
      buffer = overlap;
      bufferTokens = ot;
    }
    buffer.push(sentence);
    bufferTokens += sentTokens;
  }

  if (buffer.length > 0) {
    const chunkText = buffer.join(' ').trim();
    if (chunkText.length > 20) {
      chunks.push({
        chunkId: `${docId}_p${pageNumber}_${uuidv4().slice(0, 8)}`,
        docId,
        caseId,
        pageNumber,
        text: chunkText,
        sourceQuote: chunkText.slice(0, 200),
        tokenCount: estimateTokens(chunkText),
      });
    }
  }

  return chunks;
}
