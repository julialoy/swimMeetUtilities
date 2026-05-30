import { parseCsv } from './csvParser';
import type {
  SwimTopiaReportCard,
  SwimTopiaAthlete,
  SwimTopiaEventSummary,
  SwimTopiaMeetResult,
} from '../types';

type RawRow = Record<string, string>;

/** Returns the sorted set of meet numbers (1–17) present in the CSV headers. */
function detectMeetNumbers(fields: string[]): number[] {
  const seen = new Set<number>();
  for (const f of fields) {
    const m = f.match(/^Meet(\d+)-/);
    if (m) seen.add(parseInt(m[1], 10));
  }
  return [...seen].sort((a, b) => a - b);
}

/** Interprets SwimTopia's boolean-ish strings ('true', 'yes', '1') as boolean. */
function parseBool(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

function extractMeetResult(row: RawRow, n: number): SwimTopiaMeetResult | null {
  const name = row[`Meet${n}-Name`]?.trim();
  if (!name) return null;
  return {
    meetName: name,
    result:     row[`Meet${n}-Result`]?.trim()     ?? '',
    resultSec:  parseFloat(row[`Meet${n}-ResultSec`]) || 0,
    improved:   parseBool(row[`Meet${n}-Improved`] ?? ''),
    points:     parseFloat(row[`Meet${n}-Points`])  || 0,
    date:       row[`Meet${n}-Date`]?.trim()        ?? '',
  };
}

function extractEventSummary(row: RawRow, meetNumbers: number[]): SwimTopiaEventSummary {
  const meetResults: SwimTopiaMeetResult[] = [];
  for (const n of meetNumbers) {
    const r = extractMeetResult(row, n);
    if (r) meetResults.push(r);
  }
  return {
    eventDistance:    row['EventDistance']?.trim()    ?? '',
    eventStroke:      row['EventStroke']?.trim()      ?? '',
    meetResults,
    totalResults:     parseInt(row['TotalResults'],   10) || 0,
    totalImproved:    parseInt(row['TotalImproved'],  10) || 0,
    totalPoints:      parseFloat(row['TotalPoints'])       || 0,
    amountImprovedSec: parseFloat(row['AmountImprovedSec']) || 0,
    percentImproved:  parseFloat(row['PercentImproved'])    || 0,
  };
}

/**
 * Parses a SwimTopia athlete report card CSV export.
 *
 * The CSV is in wide format: each row represents one athlete × one event,
 * with up to 17 meet result columns (Meet1-Name … Meet17-Points).
 * Rows for the same AthleteId are collapsed into a single SwimTopiaAthlete
 * whose `events` array holds one entry per row.
 *
 * @param file - The `.csv` file selected or dropped by the user.
 */
export async function parseSwimTopiaReportCard(
  file: File
): Promise<SwimTopiaReportCard> {
  const { data: rows, errors, fields } = await parseCsv<RawRow>(file);

  const meetNumbers = detectMeetNumbers(fields);

  // Group rows by AthleteId, preserving insertion order
  const grouped = new Map<string, RawRow[]>();
  for (const row of rows) {
    const id = row['AthleteId']?.trim() ?? '';
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(row);
  }

  const athletes: SwimTopiaAthlete[] = [];
  for (const athleteRows of grouped.values()) {
    const first = athleteRows[0];
    athletes.push({
      ageGroup:  first['AgeGroup']?.trim()  ?? '',
      athleteId: first['AthleteId']?.trim() ?? '',
      lastName:  first['LastName']?.trim()  ?? '',
      firstName: first['FirstName']?.trim() ?? '',
      age:       parseInt(first['Age'], 10)  || 0,
      events:    athleteRows.map(row => extractEventSummary(row, meetNumbers)),
    });
  }

  return { athletes, errors };
}
