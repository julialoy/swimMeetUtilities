// @vitest-environment jsdom
// Integration tests for parseImprovementLabelsPdf.
// Requires: src/parsers/__tests__/fixutres/improvement_labels.pdf
// All tests in this file are skipped automatically when the fixture is absent.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FIXTURE = join(__dirname, 'fixutres', 'improvement_labels.pdf');
const HAS_FIXTURE = existsSync(FIXTURE);

describe('parseImprovementLabelsPdf', () => {
  if (!HAS_FIXTURE) {
    it.todo('drop improvement_labels.pdf into src/parsers/__tests__/fixutres/ to enable integration tests');
    return;
  }

  // Lazy import so the module (and pdfjs-dist) only loads when the fixture exists.
  let parse: typeof import('../improvementLabelsParser').parseImprovementLabelsPdf;
  let result: Awaited<ReturnType<typeof parse>>;

  beforeAll(async () => {
    ({ parseImprovementLabelsPdf: parse } = await import('../improvementLabelsParser'));
    const bytes = readFileSync(FIXTURE);
    const file = new File([bytes], 'improvement_labels.pdf', { type: 'application/pdf' });
    result = await parse(file);
  });

  it('parses without errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('parses the expected number of labels', () => {
    expect(result.labels.length).toBeGreaterThan(0);
  });

  it('first label has required fields', () => {
    const first = result.labels[0];
    expect(first.eventNumber).toBeDefined();
    expect(first.eventDescription).toBeDefined();
    expect(first.lastName).toBeDefined();
    expect(first.firstName).toBeDefined();
    expect(first.age).toBeGreaterThan(0);
    expect(first.personalBestTime).toBeDefined();
    expect(first.improvement).toBeLessThan(0);
    expect(first.team).toBeDefined();
    expect(first.date).toBeDefined();
    expect(first.meetName).toBeDefined();
  });

  it('all labels share the same meet date and name', () => {
    const date = result.labels[0].date;
    const meetName = result.labels[0].meetName;
    expect(result.labels.every(l => l.date === date)).toBe(true);
    expect(result.labels.every(l => l.meetName === meetName)).toBe(true);
  });

  it('all improvement values are negative', () => {
    expect(result.labels.every(l => l.improvement < 0)).toBe(true);
  });

  it('parses hyphenated last names correctly', () => {
    const hyphenated = result.labels.find(l => l.lastName.includes('-'));
    expect(hyphenated).toBeDefined();
  });

  it('parses event numbers with letter suffixes', () => {
    const withSuffix = result.labels.find(l => /[A-Za-z]$/.test(l.eventNumber));
    expect(withSuffix).toBeDefined();
  });
});
