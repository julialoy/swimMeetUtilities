import { useState, useRef } from 'react';
import { parseSwimTopiaReportCard } from '../parsers/swimTopiaParser';
import { ageGroupDisplay, eventKey, extractMeetNames, formatEventTitle, formatSwimTime, getTopTimes, olderAgeGroups, sortTopTimes, topTimeKey, type TopTimesSortKey, type TopTimesSortOrder } from '../utils/topTimes';
import type { TopTimeEntry } from '../types';
import { generateTopTimesPdf } from '../generators/topTimesPdfGenerator';
import type { SwimTopiaReportCard } from '../types';

export function SwimTopiaTopTimes() {
  const [reportCard, setReportCard] = useState<SwimTopiaReportCard | null>(null);
  const [availableMeets, setAvailableMeets] = useState<string[]>([]);
  const [selectedMeets, setSelectedMeets] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(3);
  const [sortOrder, setSortOrder] = useState<TopTimesSortOrder>(['event', 'rank', 'name']);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fileName, setFileName] = useState('');
  // Manually-flagged swim-ups: entry key → older age-group display name.
  const [swimUps, setSwimUps] = useState<Map<string, string>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setFileName(file.name);
    const parsed = await parseSwimTopiaReportCard(file);
    const meets = extractMeetNames(parsed.athletes);
    setReportCard(parsed);
    setAvailableMeets(meets);
    setSelectedMeets(new Set(meets));
    setSwimUps(new Map());
    setLoading(false);
  }

  function setSwimUp(entry: TopTimeEntry, group: string) {
    setSwimUps(prev => {
      const next = new Map(prev);
      if (group) next.set(topTimeKey(entry), group); else next.delete(topTimeKey(entry));
      return next;
    });
  }

  async function handleDownloadPdf() {
    setGenerating(true);
    const bytes = await generateTopTimesPdf(entries);
    const baseName = fileName.replace(/\.csv$/i, '');
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_top${topN}_times.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  }

  function updateSortOrder(level: 0 | 1 | 2, newKey: TopTimesSortKey) {
    setSortOrder(prev => {
      if (prev[level] === newKey) return prev;
      const next = [...prev] as TopTimesSortOrder;
      next[level] = newKey;
      return next;
    });
  }

  function toggleMeet(meet: string) {
    setSelectedMeets(prev => {
      const next = new Set(prev);
      if (next.has(meet)) next.delete(meet); else next.add(meet);
      return next;
    });
  }

  // Swim-up flags are applied inside getTopTimes: flagged swimmers are moved
  // into the older group's event and re-ranked, so entries are print-ready.
  const entries = reportCard
    ? sortTopTimes(getTopTimes(reportCard.athletes, selectedMeets, topN, swimUps), sortOrder)
    : [];

  const eventCount = new Set(entries.map(e => eventKey(e.ageGroup, e.eventDistance, e.eventStroke))).size;

  return (
    <div>
      <h2>SwimTopia Top Times</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Upload a SwimTopia Athlete Report Card CSV to see the top N times per event across selected meets.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{ padding: '0.5rem 1rem', cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Parsing…' : reportCard ? `Change file (${fileName})` : 'Choose report card CSV…'}
      </button>

      {reportCard && reportCard.errors.length > 0 && (
        <details style={{ color: 'orange', marginTop: '0.5rem' }}>
          <summary>{reportCard.errors.length} parse warning(s)</summary>
          <ul>{reportCard.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      )}

      {reportCard && (
        <>
          <p style={{ marginTop: '0.75rem', color: '#555' }}>
            {reportCard.athletes.length} athletes · {availableMeets.length} meets detected
          </p>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <label style={{ fontWeight: 600 }}>
                Top N times per event:
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={topN}
                  onChange={(e) => setTopN(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: 60, marginLeft: '0.5rem', padding: '0.25rem 0.4rem' }}
                />
              </label>
              {topN === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  0 = all athletes (no cutoff)
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Sort order:</div>
              {(['Primary', 'Secondary', 'Tertiary'] as const).map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                  <span style={{ width: 72, color: '#555' }}>{label}:</span>
                  <select
                    value={sortOrder[i as 0 | 1 | 2]}
                    onChange={(e) => updateSortOrder(i as 0 | 1 | 2, e.target.value as TopTimesSortKey)}
                    style={{ padding: '0.2rem 0.3rem' }}
                  >
                    <option value="event">Event</option>
                    <option value="rank">Rank (fastest first)</option>
                    <option value="name">Athlete name</option>
                    <option value="age">Age group</option>
                  </select>
                </div>
              ))}
            </div>

            <div>
              <div style={{ marginBottom: '0.4rem', fontWeight: 600 }}>
                Include meets:
                <button
                  onClick={() => setSelectedMeets(new Set(availableMeets))}
                  style={{ marginLeft: '0.75rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedMeets(new Set())}
                  style={{ marginLeft: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}
                >
                  None
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '0.2rem 1.5rem',
                maxHeight: 200,
                overflowY: 'auto',
                paddingRight: '0.5rem',
              }}>
                {availableMeets.map(meet => (
                  <label key={meet} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMeets.has(meet)}
                      onChange={() => toggleMeet(meet)}
                    />
                    {meet}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            {entries.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <p style={{ color: '#555', margin: 0 }}>
                    {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} across {eventCount} event{eventCount !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={generating}
                    style={{ padding: '0.35rem 0.85rem', cursor: generating ? 'wait' : 'pointer' }}
                  >
                    {generating ? 'Generating…' : 'Download PDF'}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        {['Event', 'Athlete', 'Time', 'Meet', 'Date', 'Swam up to'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, i) => {
                        // A moved swim-up's own group is in swamUpFrom; drive the
                        // selector's options off it so the choices stay stable.
                        const ownGroup = e.swamUpFrom ?? ageGroupDisplay(e.ageGroup);
                        const options = olderAgeGroups(ownGroup);
                        return (
                          <tr key={topTimeKey(e)} style={{ background: e.swamUpFrom ? '#fff8e1' : i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                            <td style={tdStyle}>{formatEventTitle(e.ageGroup, e.eventDistance, e.eventStroke)}</td>
                            <td style={tdStyle}>
                              {e.lastName}, {e.firstName}
                              {e.swamUpFrom && <span style={{ color: '#a67c00' }}> (swim up)</span>}
                            </td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{formatSwimTime(e.result)}</td>
                            <td style={tdStyle}>{e.meetName}</td>
                            <td style={tdStyle}>{e.date}</td>
                            <td style={tdStyle}>
                              {options.length > 0 ? (
                                <select
                                  value={e.swamUpFrom ? ageGroupDisplay(e.ageGroup) : ''}
                                  onChange={ev => setSwimUp(e, ev.target.value)}
                                  style={{ fontSize: '0.8rem', padding: '0.1rem 0.2rem' }}
                                >
                                  <option value="">—</option>
                                  {options.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                              ) : (
                                <span style={{ color: '#bbb' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ color: '#888' }}>
                {selectedMeets.size === 0
                  ? 'Select at least one meet to see results.'
                  : 'No timed results found for the selected meets.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px', background: '#f0f0f0', textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd', padding: '4px 8px',
};
