/**
 * Simulates 3 rounds of operator editing to demonstrate the learning loop.
 * The assessment explicitly permits simulated edits; this script creates
 * realistic ones that expose the pattern-extraction and prompt-augmentation path.
 */
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('\n🎭 Simulating operator edits for edit-loop demonstration\n');

  const { ingestFolder } = await import('../src/processing/ingestPipeline');
  const { generateDraft } = await import('../src/generation/draftGenerator');
  const { captureEdit } = await import('../src/learning/editCapture');
  const { analyzeEdits } = await import('../src/learning/editAnalyzer');
  const { upsertPatterns, getPatternStats, getAllPatterns } = await import('../src/learning/patternStore');
  const { loadEditEvents } = await import('../src/learning/editCapture');
  const { config, resolveDataPath } = await import('../src/config');

  const inputDir = resolveDataPath(config.data.samplesInputDir);
  if (!fs.existsSync(inputDir) || fs.readdirSync(inputDir).filter(f => !f.startsWith('.')).length === 0) {
    console.log('Generating sample documents first...');
    const genSamples = await import('./generate-samples');
    void genSamples;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('Ingesting documents...');
  await ingestFolder(inputDir);

  // ── Round 1: Fresh draft, no learned patterns ─────────────────────────────
  console.log('\n── Round 1: First draft (no learned patterns) ──────────────────');
  const draft1 = await generateDraft('sample-001');

  const edit1: Record<string, string> = {};
  for (const section of draft1.sections) {
    let content = section.bullets.map(b => `- ${b.text}`).join('\n');

    // Operator edit 1: language style corrections
    content = content.replace(/\bshall\b/gi, 'must');
    content = content.replace(/\bsaid\s+/gi, 'the ');
    content = content.replace(/\bherein\b/gi, 'in this document');

    // Operator edit 2: always add presiding judge and filing court
    if (section.heading === 'Case Overview') {
      if (!content.toLowerCase().includes('presiding judge')) {
        content += '\n- Presiding judge: Hon. Margaret L. Rivers, U.S. District Judge';
      }
      if (!content.toLowerCase().includes('filing court')) {
        content += '\n- Filing court: United States District Court, Northern District of California';
      }
    }

    // Operator edit 3: ensure plaintiff counsel is listed in Parties
    if (section.heading === 'Parties') {
      if (!content.toLowerCase().includes("plaintiff's counsel") && !content.toLowerCase().includes('chen & patel')) {
        content += "\n- Plaintiff's counsel: Priya Patel, Esq., Chen & Patel LLP (Bar No. 287341)";
        content += "\n- Defense counsel: David Ng, Esq., Ng & Associates";
      }
    }

    // Operator edit 4: add specific statutory references in Facts section
    if (section.heading === 'Facts Alleged / Established') {
      if (!content.includes('28 U.S.C.')) {
        content += '\n- Jurisdiction invoked under 28 U.S.C. § 1332 (diversity of citizenship; amount in controversy exceeds $75,000)';
      }
      if (!content.toLowerCase().includes('§ 12.3') && !content.toLowerCase().includes('section 12.3')) {
        content += '\n- Termination disputed under § 12.3 of the Master Service Agreement dated March 15, 2022';
      }
    }

    // Operator edit 5: concrete trial dates in Procedural History
    if (section.heading === 'Procedural History') {
      if (!content.includes('June 16, 2024')) {
        content += '\n- Trial set for June 16, 2024 at 9:00 AM, Courtroom 12';
        content += '\n- Pre-trial conference: May 28, 2024 at 2:00 PM';
      }
    }

    edit1[section.heading] = content;
  }

  const event1 = captureEdit(draft1, edit1);
  console.log(`✓ Edit event 1 captured: ${event1.editId}`);

  // ── Round 2: Second draft, same pattern corrections repeat ────────────────
  console.log('\n── Round 2: Second draft ────────────────────────────────────────');
  const draft2 = await generateDraft('sample-001');

  const edit2: Record<string, string> = {};
  for (const section of draft2.sections) {
    let content = section.bullets.map(b => `- ${b.text}`).join('\n');

    // Same operator keeps making same corrections — reinforces patterns
    content = content.replace(/\bshall\b/gi, 'must');
    content = content.replace(/\bsaid\s+/gi, 'the ');

    if (section.heading === 'Case Overview') {
      if (!content.toLowerCase().includes('presiding judge')) {
        content += '\n- Presiding judge: Hon. Margaret L. Rivers';
      }
      if (!content.toLowerCase().includes('filing court')) {
        content += '\n- Filing court: U.S. District Court, N.D. Cal.';
      }
    }
    if (section.heading === 'Parties') {
      if (!content.toLowerCase().includes('chen & patel')) {
        content += "\n- Plaintiff's counsel: Priya Patel, Esq. (Chen & Patel LLP)";
      }
    }
    if (section.heading === 'Key Dates and Chronology') {
      // Operator rewrites dates section with better chronological precision
      content += '\n- March 15, 2022: Master Service Agreement executed';
      content += '\n- December 2023: Final deliverables submitted by Plaintiffs';
      content += '\n- January 5, 2024: Wrongful termination notice sent by Defendant Doe';
      content += '\n- January 20, 2024: TechAudit LLC independent review completed';
      content += '\n- January 25, 2024: Court Order on Summary Judgment (Dkt. 47)';
      content += '\n- February 14, 2024: Complaint filed';
    }

    edit2[section.heading] = content;
  }

  const event2 = captureEdit(draft2, edit2);
  console.log(`✓ Edit event 2 captured: ${event2.editId}`);

  // ── Round 3: Citation quality corrections ─────────────────────────────────
  console.log('\n── Round 3: Third draft (citation style) ────────────────────────');
  const draft3 = await generateDraft('sample-001');

  const edit3: Record<string, string> = {};
  for (const section of draft3.sections) {
    let content = section.bullets.map((b) => {
      let text = `- ${b.text}`;
      // Operator adds explicit source references for uncited bullets
      if (b.citations.length === 0 && b.text.length > 40 && !b.text.includes('Not stated')) {
        text += ' [see source documents — citation required]';
      }
      return text;
    }).join('\n');

    content = content.replace(/\bshall\b/gi, 'must');

    if (section.heading === 'Relief Sought / Outcomes') {
      content += '\n- Compensatory damages sought: not less than $2,500,000 (para. 18, Complaint)';
      content += '\n- Punitive damages: partially dismissed per Order of Jan. 25, 2024 (Dkt. 47)';
      content += '\n- Injunctive relief: sought against further tortious interference';
      content += '\n- Attorneys\' fees: sought pursuant to Agreement and applicable law';
    }

    if (section.heading === 'Open Questions / Gaps in Record') {
      content += '\n- Punitive damages theory: viability after partial dismissal unclear';
      content += '\n- TechAudit report (Jan. 20, 2024): full findings not included in record';
      content += '\n- Settlement discussions: potentially protected under Rule 408 (motion in limine filed Apr. 20)';
    }

    edit3[section.heading] = content;
  }

  const event3 = captureEdit(draft3, edit3);
  console.log(`✓ Edit event 3 captured: ${event3.editId}`);

  // ── Learn from all edits ──────────────────────────────────────────────────
  console.log('\n── Learning from all edit events ────────────────────────────────');
  const allEvents = loadEditEvents('case_facts');
  const { patterns, summary } = await analyzeEdits(allEvents);
  upsertPatterns(patterns);

  console.log(`✓ ${summary}`);

  const stats = getPatternStats();
  console.log(`\nPattern store: ${stats.total} patterns`);
  if (stats.total > 0) {
    const topPatterns = getAllPatterns().slice(0, 5);
    for (const p of topPatterns) {
      console.log(`  [${p.type}] (${p.count}x) ${p.instruction.slice(0, 80)}...`);
    }
  }

  // ── Generate improved draft ───────────────────────────────────────────────
  console.log('\n── Generating improved V4 draft (with learned patterns) ──────────');
  const improvedDraft = await generateDraft('sample-001');

  console.log(`\n✅ Simulation complete!`);
  console.log(`   Draft v1 (no patterns): ${draft1.draftId}`);
  console.log(`   Draft v2:               ${draft2.draftId}`);
  console.log(`   Draft v3:               ${draft3.draftId}`);
  console.log(`   Draft v4 (patterns):    ${improvedDraft.draftId}`);
  console.log(`\n   Bullets in v1: ${draft1.sections.reduce((s, sec) => s + sec.bullets.length, 0)}`);
  console.log(`   Bullets in v4: ${improvedDraft.sections.reduce((s, sec) => s + sec.bullets.length, 0)}`);
  console.log(`\nNext: run  npm run eval  to see quantified improvement metrics`);

  const reportPath = path.resolve(process.cwd(), 'data/simulation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    simulated: new Date().toISOString(),
    editEvents: [event1.editId, event2.editId, event3.editId],
    patternsLearned: patterns.length,
    patternsSummary: summary,
    draftIds: {
      v1: draft1.draftId,
      v2: draft2.draftId,
      v3: draft3.draftId,
      improved: improvedDraft.draftId,
    },
  }, null, 2));
}

main().catch(err => {
  console.error('Simulation failed:', err.message);
  process.exit(1);
});
