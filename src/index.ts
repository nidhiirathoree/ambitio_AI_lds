#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('ambitio-legal')
  .description('AI-powered legal document processing and case fact summary generation')
  .version('1.0.0');

// INGEST command
program
  .command('ingest')
  .description('Ingest and process legal documents (PDF, PNG, JPG, TXT)')
  .option('-i, --input <path>', 'Input file or folder path', './data/samples/input')
  .action(async (opts) => {
    const { ingestFile, ingestFolder } = await import('./processing/ingestPipeline');
    const inputPath = path.resolve(opts.input);

    if (fs.statSync(inputPath).isDirectory()) {
      await ingestFolder(inputPath);
    } else {
      await ingestFile(inputPath);
    }
  });

// DRAFT command
program
  .command('draft')
  .description('Generate a case fact summary draft for a case')
  .requiredOption('-c, --case <caseId>', 'Case ID to generate draft for')
  .action(async (opts) => {
    const { generateDraft } = await import('./generation/draftGenerator');
    await generateDraft(opts.case);
  });

// EVIDENCE command
program
  .command('evidence')
  .description('Show evidence/grounding for a draft')
  .requiredOption('-d, --draft <draftId>', 'Draft ID to inspect')
  .action(async (opts) => {
    const { loadDraft } = await import('./generation/draftGenerator');
    const { getChunkById } = await import('./retrieval/vectorStore');

    const draft = loadDraft(opts.draft);
    if (!draft) {
      console.error(`Draft not found: ${opts.draft}`);
      process.exit(1);
    }

    console.log(`\n=== Evidence Mapping for Draft ${draft.draftId} ===`);
    console.log(`Case: ${draft.caseId} | Version: v${draft.version}`);
    console.log(`Chunks used: ${draft.retrievedChunks.length}\n`);

    for (const section of draft.sections) {
      console.log(`\n## ${section.heading}`);
      for (const bullet of section.bullets) {
        console.log(`  • ${bullet.text.slice(0, 100)}...`);
        for (const cit of bullet.citations) {
          const chunk = getChunkById(cit.chunkId, draft.caseId);
          if (chunk) {
            console.log(`    [${cit.chunkId}] doc:${chunk.docId} page:${chunk.pageNumber}`);
            console.log(`    Quote: "${cit.quote.slice(0, 80)}..."`);
          } else {
            console.log(`    [${cit.chunkId}] (chunk not found in index)`);
          }
        }
      }
    }

    if (draft.unsupportedClaims.length > 0) {
      console.log('\n⚠ UNSUPPORTED CLAIMS:');
      for (const claim of draft.unsupportedClaims) {
        console.log(`  - ${claim}`);
      }
    }
  });

// SUBMIT-EDIT command
program
  .command('submit-edit')
  .description('Submit an operator edit of a draft to feed the learning loop')
  .requiredOption('-d, --draft <draftId>', 'Draft ID being edited')
  .requiredOption('-f, --file <filePath>', 'Path to edited markdown file')
  .action(async (opts) => {
    const { loadDraft } = await import('./generation/draftGenerator');
    const { captureEditFromMarkdown } = await import('./learning/editCapture');
    const { analyzeEdits } = await import('./learning/editAnalyzer');
    const { upsertPatterns } = await import('./learning/patternStore');
    const { loadEditEvents } = await import('./learning/editCapture');

    const draft = loadDraft(opts.draft);
    if (!draft) {
      console.error(`Draft not found: ${opts.draft}`);
      process.exit(1);
    }

    const editedMd = fs.readFileSync(path.resolve(opts.file), 'utf-8');
    const event = captureEditFromMarkdown(draft, editedMd);
    console.log(`\n✓ Edit event captured: ${event.editId}`);

    // Re-analyze all events to update patterns
    const allEvents = loadEditEvents('case_facts');
    const { patterns, summary } = await analyzeEdits(allEvents);
    upsertPatterns(patterns);

    console.log(`✓ Pattern store updated`);
    console.log(`  ${summary}`);
    console.log(`\nNext draft for case_facts will incorporate learned patterns.`);
  });

// PATTERNS command
program
  .command('patterns')
  .description('List learned correction patterns from operator edits')
  .option('-t, --type <draftType>', 'Filter by draft type', 'case_facts')
  .action(async (opts) => {
    const { getTopPatterns, getPatternStats } = await import('./learning/patternStore');

    const stats = getPatternStats();
    console.log(`\n=== Learned Patterns (${stats.total} total) ===`);
    console.log(`By type: ${JSON.stringify(stats.byType)}\n`);

    const patterns = await getTopPatterns(opts.type, 20);
    if (patterns.length === 0) {
      console.log('No patterns learned yet. Submit edits first with: npm run submit-edit');
      return;
    }

    for (const p of patterns) {
      console.log(`[${p.type}] (${p.count}x) ${p.instruction}`);
      if (p.examples[0]) {
        console.log(`  Example: "${p.examples[0].original}" → "${p.examples[0].edited}"`);
      }
    }
  });

// LIST command
program
  .command('list')
  .description('List processed documents and drafts')
  .action(async () => {
    const { listProcessedDocuments } = await import('./processing/ingestPipeline');
    const { listDrafts } = await import('./generation/draftGenerator');
    const { listIndexedCases } = await import('./retrieval/vectorStore');

    const docs = listProcessedDocuments();
    const drafts = listDrafts();
    const cases = listIndexedCases();

    console.log(`\n=== Processed Documents (${docs.length}) ===`);
    for (const doc of docs) {
      console.log(`  ${doc.docId} | case:${doc.caseId} | pages:${doc.pages.length} | method:${doc.extractionMeta.method}`);
    }

    console.log(`\n=== Indexed Cases (${cases.length}) ===`);
    for (const c of cases) console.log(`  ${c}`);

    console.log(`\n=== Drafts (${drafts.length}) ===`);
    for (const d of drafts) {
      const bullets = d.sections.reduce((s: number, sec: { bullets: any[] }) => s + sec.bullets.length, 0);
      console.log(`  ${d.draftId} | case:${d.caseId} | v${d.version} | ${bullets} bullets | ${d.unsupportedClaims.length} unsupported`);
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
