import { config } from '../config';

let openaiClient: import('openai').default | null = null;

// Local TF-IDF based embedding for offline mode
export class TfIdfEmbedder {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documents: string[][] = [];
  private dim = 512;

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  addDocument(text: string): void {
    const tokens = this.tokenize(text);
    this.documents.push(tokens);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.vocabulary.set(token, (this.vocabulary.get(token) || 0) + 1);
    }
  }

  buildIdf(): void {
    const N = this.documents.length;
    for (const [term, df] of this.vocabulary) {
      this.idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
    }
  }

  embed(text: string): number[] {
    const tokens = this.tokenize(text);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Create a dense vector via hashing trick
    const vec = new Float32Array(this.dim).fill(0);
    for (const [term, count] of tf) {
      const idfVal = this.idf.get(term) || 1;
      const tfidf = (count / tokens.length) * idfVal;
      // Hash term to multiple dimensions for reduced collision
      const hash1 = hashCode(term) % this.dim;
      const hash2 = hashCode(term + '_2') % this.dim;
      const hash3 = hashCode(term + '_3') % this.dim;
      vec[Math.abs(hash1)] += tfidf;
      vec[Math.abs(hash2)] += tfidf * 0.5;
      vec[Math.abs(hash3)] += tfidf * 0.25;
    }

    return normalize(Array.from(vec));
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag === 0) return vec;
  return vec.map(v => v / mag);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Global embedder instance (lazy init)
let tfidfEmbedder: TfIdfEmbedder | null = null;

export function getLocalEmbedder(): TfIdfEmbedder {
  if (!tfidfEmbedder) {
    tfidfEmbedder = new TfIdfEmbedder();
  }
  return tfidfEmbedder;
}

export function resetLocalEmbedder(): void {
  tfidfEmbedder = new TfIdfEmbedder();
}

export async function embedText(text: string): Promise<number[]> {
  if (config.embedding.provider === 'openai' && config.embedding.openaiApiKey) {
    if (!openaiClient) {
      const OpenAI = await import('openai').then(m => m.default || m);
      openaiClient = new OpenAI({ apiKey: config.embedding.openaiApiKey });
    }
    const response = await openaiClient.embeddings.create({
      model: config.embedding.openaiModel,
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  // Local TF-IDF fallback
  const embedder = getLocalEmbedder();
  return embedder.embed(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (config.embedding.provider === 'openai' && config.embedding.openaiApiKey) {
    if (!openaiClient) {
      const OpenAI = await import('openai').then(m => m.default || m);
      openaiClient = new OpenAI({ apiKey: config.embedding.openaiApiKey });
    }
    const response = await openaiClient.embeddings.create({
      model: config.embedding.openaiModel,
      input: texts.map(t => t.slice(0, 8000)),
    });
    return response.data.map(d => d.embedding);
  }

  // Local: embed each
  return texts.map(t => embedText(t) as unknown as number[]);
}
