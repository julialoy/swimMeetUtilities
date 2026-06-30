import { useState } from 'react';
import { FileUpload } from './FileUpload';
import { parseCsv } from '../parsers/csvParser';
import { parseHy3, type Hy3ParseResult } from '../parsers/hy3TmResultsParser';
import { parseAnyLabelsPdf } from '../parsers/labelParser';
import { parseSwimTopiaReportCard } from '../parsers/swimTopiaParser';
import { generateLabelsPdf } from '../generators/awardLabelsPdfGenerator';
import { extractMeetNames } from '../utils/topTimes';
import { triggerDownload } from '../utils/download';
import type { Label, SwimTopiaReportCard, SwimTopiaEventSummary } from '../types';

/**
 * Discriminated union representing the result of a file parse operation.
 * Each variant carries the data relevant to its file format.
 */
type ParseResult =
  | { type: 'csv'; data: Record<string, string>[]; fields: string[]; errors: string[] }
  | { type: 'swimtopia'; reportCard: SwimTopiaReportCard }
  | { type: 'labels'; labels: Label[]; errors: string[]; fileName: string }
  | { type: 'hy3'; meet: Hy3ParseResult['meet']; errors: string[] }
  | { type: 'error'; message: string };

/**
 * A CSV is treated as a SwimTopia athlete report card when it carries the
 * export's distinctive identity + event columns. Generic CSVs fall back to
 * the raw table preview.
 */
function isSwimTopiaReportCard(fields: string[]): boolean {
  return ['AthleteId', 'AgeGroup', 'EventDistance', 'EventStroke'].every(f => fields.includes(f));
}

/** The fastest valid result across an event's meets, or '—' if none recorded. */
function bestResult(event: SwimTopiaEventSummary): string {
  let best: { result: string; resultSec: number } | null = null;
  for (const mr of event.meetResults) {
    if (mr.resultSec > 0 && (!best || mr.resultSec < best.resultSec)) best = mr;
  }
  return best ? best.result : '—';
}

/**
 * File upload + inspection panel: parses a dropped/selected `.csv`, `.pdf`, or
 * `.hy3` file and renders a format-specific preview of its contents.
 *
 * Currently not rendered in the app (the inspect view has no end-user value yet).
 * Re-enable by rendering `<FileInspector />` from `App`.
 */
export function FileInspector() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleDownload(labels: Label[], fileName: string) {
    setGenerating(true);
    const bytes = await generateLabelsPdf(labels);
    triggerDownload(bytes, fileName.replace(/\.pdf$/i, '_regenerated.pdf'));
    setGenerating(false);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);

    // Derive extension from filename (lowercased for case-insensitive matching)
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const parsed = await parseCsv(file);
      if (isSwimTopiaReportCard(parsed.fields)) {
        setResult({ type: 'swimtopia', reportCard: await parseSwimTopiaReportCard(file) });
      } else {
        setResult({ type: 'csv', ...parsed });
      }
    } else if (ext === 'pdf') {
      const parsed = await parseAnyLabelsPdf(file);
      setResult({ type: 'labels', ...parsed, fileName: file.name });
    } else if (ext === 'hy3') {
      const parsed = await parseHy3(file);
      setResult({ type: 'hy3', meet: parsed.meet, errors: parsed.errors });
    } else {
      setResult({ type: 'error', message: `Unsupported file type: .${ext}` });
    }

    setLoading(false);
  }

  return (
    <div>
      <p style={{ color: '#555' }}>Upload a file to inspect its contents. No data is stored or transmitted.</p>

      {/* File upload widget &mdash;calls handleFile when a file is selected */}
      <FileUpload onFile={handleFile} />

      {loading && <p style={{ marginTop: '1rem' }}>Parsing...</p>}

      {/* Results panel &mdash;rendered only after a parse completes */}
      {result && (
        <div style={{ marginTop: '1.5rem' }}>

          {/* Unsupported file type or fatal read error */}
          {result.type === 'error' && (
            <p style={{ color: 'red' }}>{result.message}</p>
          )}

          {/* CSV result: tabular preview capped at 50 rows */}
          {result.type === 'csv' && (
            <>
              <h2>CSV &mdash;{result.data.length} rows, {result.fields.length} columns</h2>
              {result.errors.length > 0 && (
                <p style={{ color: 'orange' }}>Warnings: {result.errors.join(', ')}</p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>{result.fields.map((f) => <th key={f} style={thStyle}>{f}</th>)}</tr>
                  </thead>
                  <tbody>
                    {/* Cap preview at 50 rows to avoid rendering thousands of DOM nodes */}
                    {result.data.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        {result.fields.map((f) => <td key={f} style={tdStyle}>{row[f]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.data.length > 50 && <p style={{ color: '#888' }}>Showing first 50 rows.</p>}
              </div>
            </>
          )}

          {/* SwimTopia report card: per-athlete event summaries */}
          {result.type === 'swimtopia' && (
            <>
              <h2>
                SwimTopia Report Card &mdash; {result.reportCard.athletes.length} athlete{result.reportCard.athletes.length !== 1 ? 's' : ''},{' '}
                {extractMeetNames(result.reportCard.athletes).length} meets
              </h2>
              {result.reportCard.errors.length > 0 && (
                <details style={{ color: 'orange', marginBottom: '1rem' }}>
                  <summary>{result.reportCard.errors.length} parse warning(s)</summary>
                  <ul>{result.reportCard.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
              <p style={{ color: '#555' }}>
                Tip: use the SwimTopia Top Times section below for a ranked top-N report across meets.
              </p>
              {result.reportCard.athletes.map(a => (
                <details key={a.athleteId} style={{ marginBottom: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer' }}>
                    <strong>{a.lastName}, {a.firstName}</strong> ({a.age}) &mdash; {a.ageGroup} &mdash; {a.events.length} event{a.events.length !== 1 ? 's' : ''}
                  </summary>
                  <div style={{ overflowX: 'auto', margin: '0.5rem 0 0.75rem 1.5rem' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          {['Event', 'Meets swum', 'Best time', 'Improved', 'Points'].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {a.events.map((ev, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{ev.eventDistance} {ev.eventStroke}</td>
                            <td style={tdStyle}>{ev.meetResults.length}</td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{bestResult(ev)}</td>
                            <td style={tdStyle}>{ev.totalImproved} of {ev.totalResults}</td>
                            <td style={tdStyle}>{ev.totalPoints}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </>
          )}

          {/* Label PDF (award or improvement, auto-detected): count, parse errors, preview, regenerate download */}
          {result.type === 'labels' && (
            <>
              <h2>
                {result.labels.some(l => 'place' in l) ? 'Award' : 'Improvement'} Labels
                &mdash; {result.labels.length} label{result.labels.length !== 1 ? 's' : ''}
              </h2>
              {result.errors.length > 0 && (
                <details style={{ color: 'orange', marginBottom: '1rem' }}>
                  <summary>{result.errors.length} parse error{result.errors.length !== 1 ? 's' : ''}</summary>
                  <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
              {result.labels.length > 0 && (
                <>
                  <button
                    onClick={() => handleDownload(result.labels, result.fileName)}
                    disabled={generating}
                    style={{ marginBottom: '1rem', padding: '0.5rem 1rem', cursor: generating ? 'wait' : 'pointer' }}
                  >
                    {generating ? 'Generating…' : 'Download regenerated PDF'}
                  </button>
                  <h3>Preview (first {Math.min(5, result.labels.length)} of {result.labels.length})</h3>
                  <ul style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
                    {result.labels.slice(0, 5).map((l, i) => (
                      <li key={i}>
                        {'place' in l ? (
                          <><strong>{l.placeOrdinal} Place</strong> &mdash; #{l.eventNumber} {l.eventDescription} &mdash; {l.lastName}, {l.firstName} ({l.age}) &mdash; {l.finishTime}</>
                        ) : (
                          <><strong>{l.improvement.toFixed(2)}s</strong> &mdash; #{l.eventNumber} {l.eventDescription} &mdash; {l.lastName}, {l.firstName} ({l.age}) &mdash; PB {l.personalBestTime}</>
                        )}
                      </li>
                    ))}
                  </ul>
                  {result.labels.length > 5 && (
                    <p style={{ color: '#888' }}>…and {result.labels.length - 5} more.</p>
                  )}
                </>
              )}
            </>
          )}

          {/* HY3 result: meet summary with team roster counts */}
          {result.type === 'hy3' && result.meet && (
            <>
              <h2>HY3 &mdash;{result.meet.meetInfo.meetName || 'Unknown Meet'}</h2>
              {/* Parse warnings are non-fatal; show them in a collapsible block */}
              {result.errors.length > 0 && (
                <details style={{ color: 'orange', marginBottom: '1rem' }}>
                  <summary>{result.errors.length} parse warning(s)</summary>
                  <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
              <p><strong>Course:</strong> {result.meet.meetInfo.course}</p>
              <p><strong>Dates:</strong> {result.meet.meetInfo.startDate} &ndash; {result.meet.meetInfo.endDate}</p>
              <p><strong>Teams:</strong> {result.meet.teams.length}</p>
              <p><strong>Individual Entries:</strong> {result.meet.individualEntries.length}</p>
              <p><strong>Relay Entries:</strong> {result.meet.relayEntries.length}</p>
              <h3>Teams</h3>
              <ul>
                {result.meet.teams.map((t) => (
                  <li key={t.teamCode}>{t.teamCode} &mdash;{t.teamName} ({t.swimmers.length} swimmers)</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Shared style for table header cells. */
const thStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px', background: '#f0f0f0', textAlign: 'left',
};

/** Shared style for table data cells. */
const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px',
};
