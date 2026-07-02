import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateTopTimesPdf } from '../topTimesPdfGenerator';
import type { TopTimeEntry } from '../../types';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function entry(
  distance: string,
  stroke: string,
  rank: number,
  lastName: string,
  firstName: string,
  result = '30.00S',
  meetName = 'Bespin Cup 2025',
): TopTimeEntry {
  return {
    eventDistance: distance,
    eventStroke: stroke,
    rank,
    athleteId: `${lastName}-${firstName}`,
    lastName,
    firstName,
    ageGroup: '10&U',
    age: 10,
    result,
    resultSec: 30,
    meetName,
    date: '06/14/25',
  };
}

async function pageCount(entries: TopTimeEntry[]): Promise<number> {
  const bytes = await generateTopTimesPdf(entries);
  return (await PDFDocument.load(bytes)).getPageCount();
}

// Three entries across two events — fits comfortably on one page
const SAMPLE: TopTimeEntry[] = [
  entry('50',  'Freestyle',  1, 'Organa',    'Leia',  '31.50S', 'Bespin Cup 2025'),
  entry('50',  'Freestyle',  2, 'Solo',      'Han',   '33.80S', 'Jedi Trials 2025'),
  entry('100', 'Backstroke', 1, 'Skywalker', 'Luke',  '1:15.00S', 'Coruscant Invitational'),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateTopTimesPdf', () => {
  it('returns a Uint8Array with a valid PDF header', async () => {
    const bytes = await generateTopTimesPdf(SAMPLE);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('produces 0 pages for empty input', async () => {
    expect(await pageCount([])).toBe(0);
  });

  it('produces at least 1 page for any non-empty input', async () => {
    expect(await pageCount(SAMPLE)).toBeGreaterThanOrEqual(1);
  });

  it('fits a small report on a single page', async () => {
    expect(await pageCount(SAMPLE)).toBe(1);
  });

  it('each page is US letter size (612 × 792 pts)', async () => {
    const bytes = await generateTopTimesPdf(SAMPLE);
    const doc = await PDFDocument.load(bytes);
    for (let i = 0; i < doc.getPageCount(); i++) {
      const { width, height } = doc.getPage(i).getSize();
      expect(width).toBe(612);
      expect(height).toBe(792);
    }
  });

  it('paginates onto a second page when content overflows', async () => {
    // 55 distinct events × 1 entry each — each event header + row ~31 pts,
    // 55 × (18 + 13 + 10) = 55 × 41 = 2255 pts → well beyond one page (720 pts usable)
    const many: TopTimeEntry[] = Array.from({ length: 55 }, (_, i) =>
      entry(String(i + 1), 'Freestyle', 1, 'Fett', 'Boba')
    );
    expect(await pageCount(many)).toBeGreaterThanOrEqual(2);
  });

  it('handles a single entry without error', async () => {
    const bytes = await generateTopTimesPdf([
      entry('25', 'Backstroke', 1, 'Tano', 'Ahsoka', '18.50S', 'Jedi Trials 2025'),
    ]);
    expect(bytes.length).toBeGreaterThan(0);
    expect(await pageCount([entry('25', 'Backstroke', 1, 'Tano', 'Ahsoka')])).toBe(1);
  });

  it('groups multiple entries under the same event heading', async () => {
    // All three entries share the same event — should produce exactly 1 page
    const sameEvent: TopTimeEntry[] = [
      entry('50', 'Freestyle', 1, 'Organa',    'Leia'),
      entry('50', 'Freestyle', 2, 'Solo',      'Han'),
      entry('50', 'Freestyle', 3, 'Skywalker', 'Luke'),
    ];
    expect(await pageCount(sameEvent)).toBe(1);
  });

  it('renders a swim-up entry without error (annotation stays WinAnsi-safe)', async () => {
    // Helvetica can't encode arrows; the "(swim up)" note must be ASCII.
    const swimUp: TopTimeEntry = {
      ...entry('50', 'Freestyle', 1, 'Kenobi', 'Obi-Wan', '28.00S', 'Jedi Trials 2025'),
      swamUpFrom: 'Boys 9-10',
    };
    const bytes = await generateTopTimesPdf([swimUp]);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(await pageCount([swimUp])).toBe(1);
  });

  it('renders the per-athlete layout (groupBy = "athlete") without error', async () => {
    const bytes = await generateTopTimesPdf(SAMPLE, 'athlete');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    // SAMPLE has three distinct athletes, one event each → one page.
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('renders the per-athlete layout with rank hidden (showRank = false)', async () => {
    const bytes = await generateTopTimesPdf(SAMPLE, 'athlete', false);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('keeps MCSL "07-08" and "6 & Under" entries under one 8 & Under heading', async () => {
    // 40 rows alternating between the two aliased sub-groups, same event.
    // One merged heading: 18 + 40×13 = 538 pts → 1 page.
    // If a heading reprinted at each alternation: 40×(18+13+10) = 1640 pts → 3 pages.
    const alternating: TopTimeEntry[] = Array.from({ length: 40 }, (_, i) => ({
      ...entry('25', 'Freestyle', i + 1, 'Fett', 'Boba'),
      ageGroup: i % 2 === 0 ? '07-08' : '6 & Under',
    }));
    expect(await pageCount(alternating)).toBe(1);
  });
});
