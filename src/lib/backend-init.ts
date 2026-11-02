/**
 * Initializes backend data paths for the Next.js app.
 * Project root is process.cwd() now that web/ has been collapsed into root.
 * Must be imported before any backend service module.
 */
import path from 'path';

const rootDir = process.cwd();

function resolveBackendPath(envVar: string, relativeFallback: string): string {
  const val = process.env[envVar];
  if (val) {
    if (val.startsWith('.') || val.startsWith('/')) {
      return path.resolve(rootDir, val);
    }
    return val;
  }
  return path.join(rootDir, relativeFallback);
}

process.env.PROCESSED_DIR = resolveBackendPath('PROCESSED_DIR', 'data/processed');
process.env.INDEX_DIR = resolveBackendPath('INDEX_DIR', 'data/index');
process.env.EDITS_DIR = resolveBackendPath('EDITS_DIR', 'data/edits');
process.env.PATTERNS_DB = resolveBackendPath('PATTERNS_DB', 'data/patterns.sqlite');
process.env.DATA_DIR = resolveBackendPath('DATA_DIR', 'data');

if (!process.env.LLM_API_KEY || process.env.LLM_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
  try {
    const fs = require('fs');
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([A-Z_]+)=(.+)$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].trim();
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export const ROOT_DIR = rootDir;
export const SAMPLES_INPUT = path.join(rootDir, 'data/samples/input');
export const SAMPLES_OUTPUT = path.join(rootDir, 'data/samples/output');
