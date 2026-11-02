import * as fs from 'fs';
import * as path from 'path';
import { PageData } from '../types';
import { config } from '../config';

interface PdfExtractionResult {
  pages: PageData[];
  method: 'native';
  warnings: string[];
}

export async function extractPdfNative(filePath: string): Promise<PdfExtractionResult> {
  const warnings: string[] = [];
  const pages: PageData[] = [];

  try {
    // Dynamic import to handle optional dependency
    const pdfParse = await import('pdf-parse').then(m => m.default || m);
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, {
      // Extract page-by-page via render_page callback
      pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
        return pageData.getTextContent().then((textContent) => {
          let text = '';
          let lastY: number | null = null;
          for (const item of textContent.items) {
            const y = item.transform[5];
            if (lastY !== null && Math.abs(y - lastY) > 5) {
              text += '\n';
            }
            text += item.str + ' ';
            lastY = y;
          }
          return text;
        });
      },
    });

    // pdf-parse provides full text; split by form feed or page markers
    const fullText: string = data.text || '';
    const rawPages = fullText.split(/\f/).filter(Boolean);

    if (rawPages.length === 0 && data.numpages > 0) {
      // No pages extracted, push full text as page 1
      pages.push({ pageNumber: 1, rawText: fullText.trim() });
      warnings.push('Could not split by page; all text merged into page 1');
    } else {
      for (let i = 0; i < rawPages.length; i++) {
        const rawText = rawPages[i].trim();
        pages.push({ pageNumber: i + 1, rawText });
        if (rawText.length < config.ocr.minCharsPerPage) {
          warnings.push(`Page ${i + 1} has very few characters (${rawText.length}) — may be scanned`);
        }
      }
    }

    if (pages.length === 0) {
      pages.push({ pageNumber: 1, rawText: fullText.trim() });
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`PDF native extraction failed: ${msg}`);
    // Return empty so caller routes to OCR
    pages.push({ pageNumber: 1, rawText: '' });
  }

  return { pages, method: 'native', warnings };
}

export function needsOcr(pages: PageData[]): boolean {
  const totalChars = pages.reduce((sum, p) => sum + p.rawText.length, 0);
  const avgChars = pages.length > 0 ? totalChars / pages.length : 0;
  return avgChars < config.ocr.minCharsPerPage;
}

export async function extractTextFile(filePath: string): Promise<PdfExtractionResult> {
  const warnings: string[] = [];
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.txt') {
    warnings.push(`Treating ${ext} as plain text`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  // Split on double newlines or page break markers
  const rawPages = content.split(/(?:\r?\n){3,}|\f/).filter(s => s.trim());

  const pages: PageData[] = rawPages.length > 0
    ? rawPages.map((rawText, i) => ({ pageNumber: i + 1, rawText: rawText.trim() }))
    : [{ pageNumber: 1, rawText: content.trim() }];

  return { pages, method: 'native', warnings };
}
