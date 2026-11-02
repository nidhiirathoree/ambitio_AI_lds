import * as fs from 'fs';
import * as path from 'path';
import { CorrectionPattern } from '../types';
import { config, resolveDataPath } from '../config';

let db: import('better-sqlite3').Database | null = null;

function getDb(): import('better-sqlite3').Database {
  if (db) return db;

  const dbPath = resolveDataPath(config.data.patternsDb);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const Database = require('better-sqlite3');
  db = new Database(dbPath);

  db!.exec(`
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      trigger TEXT NOT NULL,
      instruction TEXT NOT NULL,
      examples TEXT NOT NULL DEFAULT '[]',
      count INTEGER NOT NULL DEFAULT 1,
      last_seen TEXT NOT NULL,
      draft_type TEXT NOT NULL DEFAULT 'case_facts'
    );

    CREATE INDEX IF NOT EXISTS idx_draft_type ON patterns(draft_type);
    CREATE INDEX IF NOT EXISTS idx_count ON patterns(count DESC);
  `);

  return db!;
}

export function upsertPattern(pattern: CorrectionPattern): void {
  const store = getDb();

  // Check for existing similar pattern
  const existing = store
    .prepare('SELECT * FROM patterns WHERE type = ? AND trigger = ? AND draft_type = ?')
    .get(pattern.type, pattern.trigger, pattern.draftType) as any;

  if (existing) {
    const existingExamples = JSON.parse(existing.examples) as Array<{ original: string; edited: string }>;
    const merged = [...existingExamples, ...pattern.examples].slice(0, 5);

    store
      .prepare(`
        UPDATE patterns
        SET count = count + ?,
            instruction = ?,
            examples = ?,
            last_seen = ?
        WHERE id = ?
      `)
      .run(pattern.count, pattern.instruction, JSON.stringify(merged), pattern.lastSeen, existing.id);
  } else {
    store
      .prepare(`
        INSERT INTO patterns (id, type, trigger, instruction, examples, count, last_seen, draft_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        pattern.id,
        pattern.type,
        pattern.trigger,
        pattern.instruction,
        JSON.stringify(pattern.examples),
        pattern.count,
        pattern.lastSeen,
        pattern.draftType
      );
  }
}

export function upsertPatterns(patterns: CorrectionPattern[]): void {
  for (const pattern of patterns) {
    upsertPattern(pattern);
  }
}

export async function getTopPatterns(draftType: string, limit = 10): Promise<CorrectionPattern[]> {
  try {
    const store = getDb();

    const rows = store
      .prepare(`
        SELECT * FROM patterns
        WHERE draft_type = ?
        ORDER BY count DESC, last_seen DESC
        LIMIT ?
      `)
      .all(draftType, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      trigger: row.trigger,
      instruction: row.instruction,
      examples: JSON.parse(row.examples),
      count: row.count,
      lastSeen: row.last_seen,
      draftType: row.draft_type,
    }));
  } catch {
    return [];
  }
}

export function getAllPatterns(): CorrectionPattern[] {
  try {
    const store = getDb();
    const rows = store.prepare('SELECT * FROM patterns ORDER BY count DESC').all() as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      trigger: row.trigger,
      instruction: row.instruction,
      examples: JSON.parse(row.examples),
      count: row.count,
      lastSeen: row.last_seen,
      draftType: row.draft_type,
    }));
  } catch {
    return [];
  }
}

export function clearPatterns(draftType?: string): void {
  const store = getDb();
  if (draftType) {
    store.prepare('DELETE FROM patterns WHERE draft_type = ?').run(draftType);
  } else {
    store.prepare('DELETE FROM patterns').run();
  }
}

export function getPatternStats(): { total: number; byType: Record<string, number> } {
  try {
    const store = getDb();
    const total = (store.prepare('SELECT COUNT(*) as cnt FROM patterns').get() as any).cnt;
    const byTypeRows = store
      .prepare('SELECT type, COUNT(*) as cnt FROM patterns GROUP BY type')
      .all() as Array<{ type: string; cnt: number }>;

    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.type] = row.cnt;
    }

    return { total, byType };
  } catch {
    return { total: 0, byType: {} };
  }
}
