import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { config } from '../config';

const fastify = Fastify({ logger: true });

async function buildApp() {
  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  // GET / — health check
  fastify.get('/', async () => ({
    status: 'ok',
    service: 'ambitio-legal-drafts',
    version: '1.0.0',
  }));

  // GET /cases — list cases
  fastify.get('/cases', async () => {
    const { listIndexedCases } = await import('../retrieval/vectorStore');
    const { listProcessedDocuments } = await import('../processing/ingestPipeline');
    const cases = listIndexedCases();
    const docs = listProcessedDocuments();
    return { cases, documents: docs.map(d => ({ docId: d.docId, caseId: d.caseId, pages: d.pages.length })) };
  });

  // POST /ingest — upload and process a file
  fastify.post('/ingest', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const tmpPath = path.join(os.tmpdir(), data.filename);
    const buffer = await data.toBuffer();
    fs.writeFileSync(tmpPath, buffer);

    try {
      const { ingestFile } = await import('../processing/ingestPipeline');
      const doc = await ingestFile(tmpPath);
      return { success: true, docId: doc.docId, caseId: doc.caseId, pages: doc.pages.length };
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  });

  // POST /cases/:id/draft — generate draft
  fastify.post<{ Params: { id: string } }>('/cases/:id/draft', async (req, reply) => {
    const { id } = req.params;
    try {
      const { generateDraft } = await import('../generation/draftGenerator');
      const draft = await generateDraft(id);
      return { success: true, draftId: draft.draftId, version: draft.version };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /cases/:id/drafts — list drafts for a case
  fastify.get<{ Params: { id: string } }>('/cases/:id/drafts', async (req) => {
    const { listDrafts } = await import('../generation/draftGenerator');
    return { drafts: listDrafts(req.params.id) };
  });

  // GET /cases/:id/draft/:draftId — get draft
  fastify.get<{ Params: { id: string; draftId: string } }>('/cases/:id/draft/:draftId', async (req, reply) => {
    const { loadDraft } = await import('../generation/draftGenerator');
    const draft = loadDraft(req.params.draftId);
    if (!draft) return reply.status(404).send({ error: 'Draft not found' });
    return draft;
  });

  // GET /cases/:id/draft/:draftId/evidence — evidence mapping
  fastify.get<{ Params: { id: string; draftId: string } }>('/cases/:id/draft/:draftId/evidence', async (req, reply) => {
    const { loadDraft } = await import('../generation/draftGenerator');
    const { getChunkById } = await import('../retrieval/vectorStore');
    const draft = loadDraft(req.params.draftId);
    if (!draft) return reply.status(404).send({ error: 'Draft not found' });

    const evidence = [];
    for (const section of draft.sections) {
      for (const bullet of section.bullets) {
        for (const cit of bullet.citations) {
          const chunk = getChunkById(cit.chunkId, draft.caseId);
          evidence.push({
            section: section.heading,
            bulletText: bullet.text.slice(0, 100),
            chunkId: cit.chunkId,
            quote: cit.quote,
            chunkText: chunk?.text?.slice(0, 300),
            docId: chunk?.docId,
            pageNumber: chunk?.pageNumber,
          });
        }
      }
    }
    return { draftId: draft.draftId, evidence, unsupportedClaims: draft.unsupportedClaims };
  });

  // PUT /cases/:id/draft/:draftId — submit operator edit
  fastify.put<{ Params: { id: string; draftId: string }; Body: { editedSections: Record<string, string> } }>(
    '/cases/:id/draft/:draftId',
    async (req, reply) => {
      const { loadDraft } = await import('../generation/draftGenerator');
      const { captureEdit } = await import('../learning/editCapture');
      const { analyzeEdits, } = await import('../learning/editAnalyzer');
      const { upsertPatterns } = await import('../learning/patternStore');
      const { loadEditEvents } = await import('../learning/editCapture');

      const draft = loadDraft(req.params.draftId);
      if (!draft) return reply.status(404).send({ error: 'Draft not found' });

      const { editedSections } = req.body;
      if (!editedSections) return reply.status(400).send({ error: 'editedSections required' });

      const event = captureEdit(draft, editedSections);
      const allEvents = loadEditEvents('case_facts');
      const { patterns, summary } = await analyzeEdits(allEvents);
      upsertPatterns(patterns);

      return { success: true, editId: event.editId, patternsSummary: summary };
    }
  );

  // GET /patterns — list learned patterns
  fastify.get('/patterns', async () => {
    const { getTopPatterns, getPatternStats } = await import('../learning/patternStore');
    const patterns = await getTopPatterns('case_facts', 20);
    const stats = getPatternStats();
    return { stats, patterns };
  });

  // Serve the UI
  const publicDir = path.resolve(process.cwd(), 'public');
  fastify.get('/ui', async (req, reply) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      reply.type('text/html');
      return fs.readFileSync(indexPath, 'utf-8');
    }
    return reply.status(404).send({ error: 'UI not found' });
  });

  return fastify;
}

buildApp().then(app => {
  app.listen({ port: config.api.port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`\nAmbitio Legal API running at http://localhost:${config.api.port}`);
    console.log(`UI: http://localhost:${config.api.port}/ui`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
