import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProcessedDocument } from '../types';
import { extractPdfNative, extractTextFile, needsOcr } from './pdfExtractor';
import { extractImageOcr, extractPdfOcr } from './ocrExtractor';
import { extractStructured } from './structureExtractor';
import { assessQuality, analyzePageNoisiness } from './quality';
import { config, resolveDataPath } from '../config';
import { indexDocument } from '../retrieval/vectorStore';
import { chunkDocument } from '../retrieval/chunker';

const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];

export function deriveDocId(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[^a-zA-Z0-9\-_]/g, '_').toLowerCase();
}

export function deriveCaseId(filePath: string): string {
  // Case ID from parent folder name or filename prefix before first underscore
  const dir = path.basename(path.dirname(filePath));
  if (dir && dir !== 'input' && dir !== 'samples' && dir !== '.') return dir;
  const base = path.basename(filePath, path.extname(filePath));
  // Filename convention: {caseId}_{docType}.ext  e.g. sample-001_clean_complaint.txt
  const underscoreIdx = base.indexOf('_');
  if (underscoreIdx > 0) return base.slice(0, underscoreIdx);
  return base;
}

async function processFile(filePath: string): Promise<ProcessedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const docId = deriveDocId(filePath);
  const caseId = deriveCaseId(filePath);
  let pages = [];
  let method: 'native' | 'ocr' | 'mixed' = 'native';
  const warnings: string[] = [];

  console.log(`  Processing: ${path.basename(filePath)} (${ext})`);

  if (ext === '.pdf') {
    const nativeResult = await extractPdfNative(filePath);
    warnings.push(...nativeResult.warnings);

    if (needsOcr(nativeResult.pages)) {
      console.log(`    → Low text yield, routing to OCR`);
      const ocrResult = await extractPdfOcr(filePath);
      warnings.push(...ocrResult.warnings);
      pages = ocrResult.pages;
      method = nativeResult.pages.some(p => p.rawText.length > 10) ? 'mixed' : 'ocr';
    } else {
      pages = nativeResult.pages;
      method = 'native';
    }
  } else if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(ext)) {
    console.log(`    → Image file, routing to OCR`);
    const ocrResult = await extractImageOcr(filePath);
    warnings.push(...ocrResult.warnings);
    pages = ocrResult.pages;
    method = 'ocr';
  } else {
    const textResult = await extractTextFile(filePath);
    warnings.push(...textResult.warnings);
    pages = textResult.pages;

    // Detect OCR-like noise patterns in text files (simulated scans, noisy text)
    let anyNoisy = false;
    for (const page of pages) {
      const noise = analyzePageNoisiness(page.rawText);
      if (noise.isNoisy) {
        anyNoisy = true;
        page.confidence = Math.round(noise.confidence * 10) / 10;
        page.unclearSpans = noise.unclearSpans.length > 0 ? noise.unclearSpans : undefined;
      }
    }
    method = anyNoisy ? 'mixed' : 'native';
    if (anyNoisy) warnings.push('Document contains OCR-like noise patterns — confidence flagged per page');
  }

  // Quality assessment
  const quality = assessQuality(pages);
  warnings.push(...quality.warnings);

  // Structured extraction
  const fullText = pages.map(p => p.rawText).join('\n\n');
  console.log(`    → Extracting structured fields`);
  const structured = await extractStructured(fullText);

  const doc: ProcessedDocument = {
    docId,
    sourcePath: filePath,
    caseId,
    pages,
    structured,
    extractionMeta: { method, warnings },
  };

  return doc;
}

export async function ingestFile(filePath: string): Promise<ProcessedDocument> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const doc = await processFile(resolvedPath);

  // Persist processed document
  const processedDir = resolveDataPath(config.data.processedDir);
  fs.mkdirSync(processedDir, { recursive: true });
  const outPath = path.join(processedDir, `${doc.docId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
  console.log(`    → Saved: ${outPath}`);

  // Chunk and index
  console.log(`    → Chunking and indexing`);
  const chunks = chunkDocument(doc);
  await indexDocument(chunks, doc.caseId);

  console.log(`    ✓ ${doc.docId}: ${doc.pages.length} pages, ${chunks.length} chunks, method=${doc.extractionMeta.method}`);

  return doc;
}

export async function ingestFolder(folderPath: string): Promise<ProcessedDocument[]> {
  const resolvedFolder = path.resolve(folderPath);

  if (!fs.existsSync(resolvedFolder)) {
    throw new Error(`Folder not found: ${resolvedFolder}`);
  }

  const files = fs.readdirSync(resolvedFolder)
    .filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(resolvedFolder, f));

  if (files.length === 0) {
    console.warn(`No supported files found in ${resolvedFolder}`);
    return [];
  }

  console.log(`\nIngesting ${files.length} files from ${resolvedFolder}\n`);

  const results: ProcessedDocument[] = [];
  for (const file of files) {
    try {
      const doc = await ingestFile(file);
      results.push(doc);
    } catch (err) {
      console.error(`  ✗ Failed to process ${path.basename(file)}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✓ Ingested ${results.length}/${files.length} documents`);
  return results;
}

export function loadProcessedDocument(docId: string): ProcessedDocument | null {
  const processedDir = resolveDataPath(config.data.processedDir);
  const filePath = path.join(processedDir, `${docId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function listProcessedDocuments(): ProcessedDocument[] {
  const processedDir = resolveDataPath(config.data.processedDir);
  if (!fs.existsSync(processedDir)) return [];

  return fs.readdirSync(processedDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(processedDir, f), 'utf-8')));
}

export function getDocumentsByCaseId(caseId: string): ProcessedDocument[] {
  return listProcessedDocuments().filter(d => d.caseId === caseId);
}
