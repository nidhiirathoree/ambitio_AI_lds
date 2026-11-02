import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

function resolveProvider(): 'anthropic' | 'openai' | 'mock' {
  const explicit = process.env.LLM_PROVIDER as string | undefined;
  if (explicit === 'anthropic' || explicit === 'openai' || explicit === 'mock') return explicit;
  // Auto-detect from available keys
  const anthropicKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (anthropicKey && anthropicKey !== 'YOUR_ANTHROPIC_API_KEY_HERE') return 'anthropic';
  if (openaiKey) return 'openai';
  return 'mock';
}

function resolveApiKey(): string {
  const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (key === 'YOUR_ANTHROPIC_API_KEY_HERE') return '';
  return key;
}

export const config = {
  llm: {
    provider: resolveProvider(),
    apiKey: resolveApiKey(),
    model: process.env.LLM_MODEL || 'claude-sonnet-4-6',
    openaiModel: process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini',
  },
  embedding: {
    provider: (process.env.EMBEDDING_PROVIDER || 'local') as 'openai' | 'local',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: 'text-embedding-3-small',
  },
  ocr: {
    lang: process.env.TESSERACT_LANG || 'eng',
    minCharsPerPage: 50,
  },
  data: {
    dir: process.env.DATA_DIR || './data',
    processedDir: process.env.PROCESSED_DIR || './data/processed',
    indexDir: process.env.INDEX_DIR || './data/index',
    editsDir: process.env.EDITS_DIR || './data/edits',
    patternsDb: process.env.PATTERNS_DB || './data/patterns.sqlite',
    samplesInputDir: './data/samples/input',
    samplesOutputDir: './data/samples/output',
  },
  retrieval: {
    chunkSize: 400,
    chunkOverlap: 80,
    topK: 16,
    diversityThreshold: 0.85,
  },
  api: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
};

export function resolveDataPath(subPath: string): string {
  return path.resolve(process.cwd(), subPath);
}

export function isLlmAvailable(): boolean {
  return config.llm.provider !== 'mock' && !!config.llm.apiKey;
}

export function logConfig(): void {
  const keyPreview = config.llm.apiKey
    ? `${config.llm.apiKey.slice(0, 8)}...`
    : '(not set — running in mock mode)';
  console.log(`  LLM:       ${config.llm.provider} / ${config.llm.model}`);
  console.log(`  API key:   ${keyPreview}`);
  console.log(`  Embedding: ${config.embedding.provider}`);
}
