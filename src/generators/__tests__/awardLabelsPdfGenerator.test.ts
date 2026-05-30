import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateLabelsPdf } from '../awardLabelsPdfGenerator';
import type { AwardLabel } from '../../types';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeLabel(place: number): AwardLabel {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const suffix = suffixes[place] ?? 'th';
  return {
    place,
    placeOrdinal:     `${place}${suffix}`,
    finishTime:       '1:23.45',
    eventNumber:      '1',
    eventDescription: 'Boys 12&U 100m IM',
    lastName:         'Skywalker',
    firstName:        'Luke',
    age:              12,
    team:             'Jedi',
    date:             'Jun 25, 2025',
    meetName:         'Bespin Invitational 2025',
  };
}

function makeLabels(count: number): AwardLabel[] {
  return Array.from({ length: count }, (_, i) => makeLabel(i + 1));
}

async function loadPages(labels: AwardLabel[]): Promise<number> {
  const bytes = await generateLabelsPdf(labels);
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateLabelsPdf', () => {
  it('returns a Uint8Array with a valid PDF header', async () => {
    const bytes = await generateLabelsPdf(makeLabels(1));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('produces 0 pages for empty input', async () => {
    expect(await loadPages([])).toBe(0);
  });

  it('produces 1 page for 1 label', async () => {
    expect(await loadPages(makeLabels(1))).toBe(1);
  });

  it('produces 1 page for 30 labels (exactly one full page)', async () => {
    expect(await loadPages(makeLabels(30))).toBe(1);
  });

  it('produces 2 pages for 31 labels (one label onto a second page)', async () => {
    expect(await loadPages(makeLabels(31))).toBe(2);
  });

  it('produces 2 pages for 60 labels (exactly two full pages)', async () => {
    expect(await loadPages(makeLabels(60))).toBe(2);
  });

  it('produces 3 pages for 61 labels', async () => {
    expect(await loadPages(makeLabels(61))).toBe(3);
  });

  it('each page is US letter size (612 × 792 pts)', async () => {
    const bytes = await generateLabelsPdf(makeLabels(31));
    const doc = await PDFDocument.load(bytes);
    for (let i = 0; i < doc.getPageCount(); i++) {
      const { width, height } = doc.getPage(i).getSize();
      expect(width).toBe(612);
      expect(height).toBe(792);
    }
  });

});
