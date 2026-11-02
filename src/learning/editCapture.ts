import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EditEvent, CaseFactsDraft } from '../types';
import { config, resolveDataPath } from '../config';

export function captureEdit(
  draft: CaseFactsDraft,
  editedSections: Record<string, string>
): EditEvent {
  const originalSections: Record<string, string> = {};
  for (const section of draft.sections) {
    originalSections[section.heading] = section.bullets
      .map(b => b.text)
      .join('\n');
  }

  const event: EditEvent = {
    editId: uuidv4(),
    draftId: draft.draftId,
    caseId: draft.caseId,
    draftType: 'case_facts',
    originalSections,
    editedSections,
    timestamp: new Date().toISOString(),
  };

  persistEditEvent(event);
  return event;
}

export function captureEditFromMarkdown(
  draft: CaseFactsDraft,
  editedMarkdown: string
): EditEvent {
  const editedSections = parseMarkdownSections(editedMarkdown);
  return captureEdit(draft, editedSections);
}

function parseMarkdownSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentHeading = '';
  const currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections[currentHeading] = currentContent.join('\n').trim();
        currentContent.length = 0;
      }
      currentHeading = headingMatch[1].trim();
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }

  if (currentHeading && currentContent.length > 0) {
    sections[currentHeading] = currentContent.join('\n').trim();
  }

  return sections;
}

function persistEditEvent(event: EditEvent): void {
  const editsDir = resolveDataPath(config.data.editsDir);
  fs.mkdirSync(editsDir, { recursive: true });
  const filePath = path.join(editsDir, `${event.editId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(event, null, 2));
  console.log(`  Edit event saved: ${filePath}`);
}

export function loadEditEvents(draftType?: string): EditEvent[] {
  const editsDir = resolveDataPath(config.data.editsDir);
  if (!fs.existsSync(editsDir)) return [];

  return fs.readdirSync(editsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(editsDir, f), 'utf-8')))
    .filter(e => !draftType || e.draftType === draftType);
}

export function loadEditEvent(editId: string): EditEvent | null {
  const editsDir = resolveDataPath(config.data.editsDir);
  const filePath = path.join(editsDir, `${editId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
