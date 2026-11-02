import '@/lib/backend-init';
import { NextRequest, NextResponse } from 'next/server';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    const { ingestFile, ingestFolder } = await import('@backend/processing/ingestPipeline');

    if (folder) {
      const docs = await ingestFolder(folder);
      return NextResponse.json({ success: true, count: docs.length, documents: docs.map(d => ({ docId: d.docId, caseId: d.caseId, pages: d.pages.length, method: d.extractionMeta.method })) });
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);

    try {
      const doc = await ingestFile(tmpPath);
      return NextResponse.json({ success: true, document: { docId: doc.docId, caseId: doc.caseId, pages: doc.pages.length, method: doc.extractionMeta.method, structured: doc.structured } });
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
