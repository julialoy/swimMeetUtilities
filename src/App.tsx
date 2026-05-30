import { useState, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { parseCsv } from './parsers/csvParser';
import { parseHy3, type Hy3ParseResult } from './parsers/hy3TmResultsParser';
import { parseAwardLabelsPdf } from './parsers/awardLabelsParser';
import { parseAnyLabelsPdf } from './parsers/labelParser';
import { generateLabelsPdf } from './generators/awardLabelsPdfGenerator';
import { sortLabels, type SortKey } from './utils/awardLabelSort';
import type { AwardLabel, Label } from './types';

/**
 * Discriminated union representing the result of a file parse operation.
 * Each variant carries the data relevant to its file format.
 */
type ParseResult =
  | { type: 'csv'; data: Record<string, string>[]; fields: string[]; errors: string[] }
  | { type: 'awardLabels'; labels: AwardLabel[]; errors: string[]; fileName: string }
  | { type: 'hy3'; meet: Hy3ParseResult['meet']; errors: string[] }
  | { type: 'error'; message: string };

/**
 * The top-level application component.
 *
 * State:
 * - `result` &mdash;the most recently parsed file result, or `null` before any upload.
 * - `loading` &mdash;true while an async parse operation is in progress.
 */
export default function App() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Combine & Reorder state ────────────────────────────────────────────────
  type UploadedPdf = { name: string; labels: Label[]; errors: string[] };
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [combining, setCombining] = useState(false);
  const combineInputRef = useRef<HTMLInputElement>(null);

  async function handleAddPdfs(files: FileList) {
    setCombining(true);
    const results = await Promise.all(
      Array.from(files).map(async (f) => {
        const parsed = await parseAnyLabelsPdf(f);
        return { name: f.name, ...parsed };
      })
    );
    setUploadedPdfs(prev => [...prev, ...results]);
    setCombining(false);
  }

  async function handleCombineDownload() {
    setCombining(true);
    const merged = uploadedPdfs.flatMap(p => p.labels);
    const sorted = sortLabels(merged, sortKey);
    const bytes = await generateLabelsPdf(sorted);
    triggerDownload(bytes, `labels_combined_${sortKey}.pdf`);
    setCombining(false);
  }

  async function handleDownload(labels: AwardLabel[], fileName: string) {
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
      setResult({ type: 'csv', ...parsed });
    } else if (ext === 'pdf') {
      const parsed = await parseAwardLabelsPdf(file);
      setResult({ type: 'awardLabels', ...parsed, fileName: file.name });
    } else if (ext === 'hy3') {
      const parsed = await parseHy3(file);
      setResult({ type: 'hy3', meet: parsed.meet, errors: parsed.errors });
    } else {
      setResult({ type: 'error', message: `Unsupported file type: .${ext}` });
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <h1>SwimUtils</h1>
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

          {/* Award labels PDF: label count, parse errors, preview, and regenerate download */}
          {result.type === 'awardLabels' && (
            <>
              <h2>Award Labels &mdash; {result.labels.length} label{result.labels.length !== 1 ? 's' : ''}</h2>
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
                        <strong>{l.placeOrdinal} Place</strong> &mdash; #{l.eventNumber} {l.eventDescription} &mdash; {l.lastName}, {l.firstName} ({l.age}) &mdash; {l.finishTime}
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
      {/* ── Combine & Reorder ─────────────────────────────────────────────── */}
      <hr style={{ margin: '2.5rem 0' }} />
      <h2>Combine &amp; Reorder Award Labels</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Add one or more award label PDFs, choose a sort order, then download the combined result.
      </p>

      <input
        ref={combineInputRef}
        type="file"
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) handleAddPdfs(e.target.files); e.target.value = ''; }}
      />
      <button
        onClick={() => combineInputRef.current?.click()}
        disabled={combining}
        style={{ padding: '0.5rem 1rem', cursor: combining ? 'wait' : 'pointer' }}
      >
        Add PDFs…
      </button>

      {uploadedPdfs.length > 0 && (
        <ul style={{ marginTop: '1rem', fontSize: '0.9rem', lineHeight: 2 }}>
          {uploadedPdfs.map((p, i) => (
            <li key={i}>
              {p.name} &mdash; {p.labels.length} label{p.labels.length !== 1 ? 's' : ''}
              {p.errors.length > 0 && (
                <span style={{ color: 'orange', marginLeft: '0.5rem' }}>
                  ({p.errors.length} parse error{p.errors.length !== 1 ? 's' : ''})
                </span>
              )}
              <button
                onClick={() => setUploadedPdfs(prev => prev.filter((_, j) => j !== i))}
                style={{ marginLeft: '0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploadedPdfs.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Sort by:</strong>
          {(['name', 'event', 'week'] as SortKey[]).map(key => (
            <label key={key} style={{ marginLeft: '1rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="sortKey"
                value={key}
                checked={sortKey === key}
                onChange={() => setSortKey(key)}
                style={{ marginRight: '0.3rem' }}
              />
              {key === 'name' ? 'Athlete name' : key === 'event' ? 'Event' : 'Week / date'}
            </label>
          ))}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleCombineDownload}
              disabled={combining}
              style={{ padding: '0.5rem 1rem', cursor: combining ? 'wait' : 'pointer' }}
            >
              {combining ? 'Generating…' : `Download combined PDF (${uploadedPdfs.reduce((n, p) => n + p.labels.length, 0)} labels)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function triggerDownload(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Shared style for table header cells. */
const thStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px', background: '#f0f0f0', textAlign: 'left',
};

/** Shared style for table data cells. */
const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px',
};
