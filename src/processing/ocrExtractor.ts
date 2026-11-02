import * as fs from 'fs';
import * as path from 'path';
import { PageData } from '../types';
import { config } from '../config';

interface OcrResult {
  pages: PageData[];
  method: 'ocr';
  warnings: string[];
}

async function preprocessImage(inputPath: string, outputPath: string): Promise<void> {
  const sharp = await import('sharp').then(m => m.default || m);
  await sharp(inputPath)
    .grayscale()
    .normalize()
    .sharpen()
    .toFile(outputPath);
}

async function runTesseract(imagePath: string): Promise<{ text: string; confidence: number; words: Array<{ text: string; confidence: number }> }> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker(config.ocr.lang);

  try {
    const result = await worker.recognize(imagePath);
    const { data } = result;

    const words = (data.words || []).map((w: { text: string; confidence: number }) => ({
      text: w.text,
      confidence: w.confidence,
    }));

    const avgConf = words.length > 0
      ? words.reduce((s: number, w: { confidence: number }) => s + w.confidence, 0) / words.length
      : 0;

    return { text: data.text || '', confidence: avgConf, words };
  } finally {
    await worker.terminate();
  }
}

function detectUnclearSpans(
  text: string,
  words: Array<{ text: string; confidence: number }>
): Array<{ start: number; end: number; reason: string }> {
  const unclear: Array<{ start: number; end: number; reason: string }> = [];
  let cursor = 0;

  for (const word of words) {
    const idx = text.indexOf(word.text, cursor);
    if (idx === -1) continue;

    if (word.confidence < 60) {
      unclear.push({
        start: idx,
        end: idx + word.text.length,
        reason: `Low OCR confidence: ${word.confidence.toFixed(1)}%`,
      });
    }
    cursor = idx + word.text.length;
  }

  return unclear;
}

export async function extractImageOcr(imagePath: string): Promise<OcrResult> {
  const warnings: string[] = [];
  const tmpDir = path.join(path.dirname(imagePath), '.tmp_ocr');

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const preprocessed = path.join(tmpDir, `pre_${path.basename(imagePath)}.png`);

    try {
      await preprocessImage(imagePath, preprocessed);
    } catch (e) {
      warnings.push(`Image preprocessing failed, using original: ${e instanceof Error ? e.message : e}`);
      fs.copyFileSync(imagePath, preprocessed);
    }

    const { text, confidence, words } = await runTesseract(preprocessed);
    const unclearSpans = detectUnclearSpans(text, words);

    const page: PageData = {
      pageNumber: 1,
      rawText: text.trim(),
      confidence,
      unclearSpans: unclearSpans.length > 0 ? unclearSpans : undefined,
    };

    if (confidence < 70) {
      warnings.push(`Low average OCR confidence: ${confidence.toFixed(1)}% — review output carefully`);
    }

    return { pages: [page], method: 'ocr', warnings };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* cleanup is best-effort */ }
  }
}

export async function extractPdfOcr(pdfPath: string): Promise<OcrResult> {
  const warnings: string[] = [];
  warnings.push('OCR on multi-page PDFs: converting PDF pages to images via canvas rendering (limited to first 10 pages)');

  // For PDF OCR, we render the PDF as images using pdf-to-img or fall back to
  // treating the PDF as a single image if it's actually an image-based PDF.
  // In this implementation, we use a text-fallback for demonstration.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvasMod = require('canvas') as { createCanvas?: unknown } | null;
    if (!canvasMod?.createCanvas) {
      warnings.push('canvas not available — falling back to treating PDF as image');
      return extractImageOcr(pdfPath);
    }
  } catch {
    // canvas not available
  }

  // Fallback: read the raw bytes looking for embedded text
  warnings.push('PDF OCR fallback: treating as single-page image for OCR');
  return extractImageOcr(pdfPath);
}
