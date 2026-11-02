import '@/lib/backend-init';
import { NextResponse } from 'next/server';
import { SAMPLES_INPUT } from '@/lib/backend-init';

export async function POST() {
  try {
    const steps: string[] = [];

    // Step 1: Generate sample documents
    steps.push('Generating sample documents...');
    const { default: genSamples } = await import('@/lib/generate-samples');
    await genSamples();
    steps.push('✓ Sample documents created');

    // Step 2: Ingest
    steps.push('Ingesting documents...');
    const { ingestFolder } = await import('@backend/processing/ingestPipeline');
    const docs = await ingestFolder(SAMPLES_INPUT);
    steps.push(`✓ Ingested ${docs.length} documents`);

    // Step 3: Generate initial draft
    steps.push('Generating V1 draft...');
    const { generateDraft } = await import('@backend/generation/draftGenerator');
    const draft1 = await generateDraft('sample-001');
    steps.push(`✓ Draft v1 created: ${draft1.draftId}`);

    // Step 4: Simulate 2 quick edits
    steps.push('Simulating operator edits...');
    const { captureEdit } = await import('@backend/learning/editCapture');
    const { analyzeEdits } = await import('@backend/learning/editAnalyzer');
    const { upsertPatterns } = await import('@backend/learning/patternStore');
    const { loadEditEvents } = await import('@backend/learning/editCapture');

    const edit1: Record<string, string> = {};
    for (const section of draft1.sections) {
      let content = section.bullets.map(b => `- ${b.text}`).join('\n');
      content = content.replace(/\bshall\b/gi, 'must');
      if (section.heading === 'Case Overview' && !content.includes('Presiding judge')) {
        content += '\n- Presiding judge: Hon. Margaret L. Rivers';
      }
      if (section.heading === 'Parties' && !content.includes('counsel')) {
        content += "\n- Plaintiff's counsel: Priya Patel, Esq. (Chen & Patel LLP)";
      }
      edit1[section.heading] = content;
    }
    captureEdit(draft1, edit1);

    const draft2 = await generateDraft('sample-001');
    const edit2: Record<string, string> = {};
    for (const s of draft2.sections) {
      let c = s.bullets.map(b => `- ${b.text}`).join('\n');
      c = c.replace(/\bshall\b/gi, 'must');
      if (s.heading === 'Case Overview' && !c.includes('filing court')) {
        c += '\n- Filing court: U.S. District Court, N.D. Cal.';
      }
      edit2[s.heading] = c;
    }
    captureEdit(draft2, edit2);

    const allEvents = loadEditEvents('case_facts');
    const { patterns, summary } = await analyzeEdits(allEvents);
    upsertPatterns(patterns);
    steps.push(`✓ ${summary}`);

    // Step 5: Generate improved draft
    steps.push('Generating improved V2 draft with learned patterns...');
    const draft3 = await generateDraft('sample-001');
    steps.push(`✓ Draft v2 (improved) created: ${draft3.draftId}`);

    return NextResponse.json({
      success: true,
      steps,
      result: {
        documents: docs.length,
        caseId: 'sample-001',
        v1DraftId: draft1.draftId,
        improvedDraftId: draft3.draftId,
        patternsLearned: patterns.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
