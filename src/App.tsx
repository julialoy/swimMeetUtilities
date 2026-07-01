import { useState, useRef } from 'react';
import { SwimTopiaTopTimes } from './components/SwimTopiaTopTimes';
import { parseAnyLabelsPdf } from './parsers/labelParser';
import { generateLabelsPdf } from './generators/awardLabelsPdfGenerator';
import { compareLabels, type SortKey } from './utils/awardLabelSort';
import { triggerDownload } from './utils/download';
import type { Label } from './types';
// NOTE: The file upload + inspect panel (CSV/PDF/HY3 preview) is temporarily
// hidden — it has no end-user value yet. The feature is preserved in
// `./components/FileInspector`; re-enable by rendering <FileInspector /> below.

/**
 * The top-level application component.
 */
export default function App() {
  // ── Combine & Reorder state ────────────────────────────────────────────────
  // Each uploaded PDF gets a stable `uid` so a label's selection id survives
  // re-renders and removals of other PDFs (plain array indices would shift).
  type UploadedPdf = { uid: string; name: string; labels: Label[]; errors: string[] };
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [combining, setCombining] = useState(false);
  // Inverse selections (empty = everything on): a label/team is active unless
  // present here. This way newly added PDFs/teams default to selected with no
  // extra bookkeeping on upload.
  const [excludedTeams, setExcludedTeams] = useState<Set<string>>(new Set());
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const combineInputRef = useRef<HTMLInputElement>(null);

  async function handleAddPdfs(files: FileList) {
    setCombining(true);
    const results = await Promise.all(
      Array.from(files).map(async (f) => {
        const parsed = await parseAnyLabelsPdf(f);
        return { uid: crypto.randomUUID(), name: f.name, ...parsed };
      })
    );
    setUploadedPdfs(prev => [...prev, ...results]);
    setCombining(false);
  }

  async function handleCombineDownload(labels: Label[]) {
    setCombining(true);
    const bytes = await generateLabelsPdf(labels);
    triggerDownload(bytes, `labels_combined_${sortKey}.pdf`);
    setCombining(false);
  }

  function toggleTeam(team: string) {
    setExcludedTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  function toggleLabel(id: string) {
    setDeselectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Removes a single uploaded PDF by its stable uid. */
  function removePdf(uid: string) {
    setUploadedPdfs(prev => prev.filter(p => p.uid !== uid));
  }

  /** Clears every uploaded PDF and resets the team/label selections — a full start-over. */
  function clearAllPdfs() {
    setUploadedPdfs([]);
    setExcludedTeams(new Set());
    setDeselectedIds(new Set());
  }

  // ── Combine & Reorder derived view (recomputed each render) ─────────────────
  // Flatten every uploaded label into a selectable row with a stable id.
  const flatLabels = uploadedPdfs.flatMap(p =>
    p.labels.map((label, li) => ({ id: `${p.uid}-${li}`, label }))
  );
  const teams = [...new Set(flatLabels.map(f => f.label.team))].sort((a, b) => a.localeCompare(b));
  // Rows from non-excluded teams, in the chosen sort order.
  const visibleRows = flatLabels
    .filter(f => !excludedTeams.has(f.label.team))
    .sort((a, b) => compareLabels(a.label, b.label, sortKey));
  const outputLabels = visibleRows.filter(f => !deselectedIds.has(f.id)).map(f => f.label);

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <h1>SwimUtils</h1>
      <p style={{ color: '#555' }}>Tools for swim-meet award labels and top times. No data is stored or transmitted.</p>

      {/* ── Combine, Filter & Select ──────────────────────────────────────── */}
      <h2>Combine, Filter &amp; Select Labels</h2>
      <p style={{ color: '#555', marginTop: 0 }}>
        Add one or more award or improvement label PDFs, filter by team, pick the exact
        labels you want, choose a sort order, then download a new combined PDF.
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
        <button
          onClick={clearAllPdfs}
          disabled={combining}
          style={{ marginLeft: '0.75rem', padding: '0.5rem 1rem', cursor: combining ? 'wait' : 'pointer' }}
        >
          Remove all ({uploadedPdfs.length})
        </button>
      )}

      {uploadedPdfs.length > 0 && (
        <ul style={{ marginTop: '1rem', fontSize: '0.9rem', lineHeight: 2 }}>
          {uploadedPdfs.map((p) => (
            <li key={p.uid}>
              {p.name} &mdash; {p.labels.length} label{p.labels.length !== 1 ? 's' : ''}
              {p.errors.length > 0 && (
                <span style={{ color: 'orange', marginLeft: '0.5rem' }}>
                  ({p.errors.length} parse error{p.errors.length !== 1 ? 's' : ''})
                </span>
              )}
              <button
                onClick={() => removePdf(p.uid)}
                aria-label={`Remove ${p.name}`}
                title={`Remove ${p.name}`}
                style={deleteBtn}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {flatLabels.length > 0 && (
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {teams.length > 1 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
                Teams:
                <button onClick={() => setExcludedTeams(new Set())} style={miniBtn}>All</button>
                <button onClick={() => setExcludedTeams(new Set(teams))} style={miniBtn}>None</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: 160, overflowY: 'auto' }}>
                {teams.map(team => (
                  <label key={team} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!excludedTeams.has(team)} onChange={() => toggleTeam(team)} />
                    {team}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Sort by:</div>
            {(['name', 'event', 'week', 'team'] as SortKey[]).map(key => (
              <label key={key} style={{ display: 'block', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '0.2rem' }}>
                <input
                  type="radio"
                  name="sortKey"
                  value={key}
                  checked={sortKey === key}
                  onChange={() => setSortKey(key)}
                  style={{ marginRight: '0.4rem' }}
                />
                {key === 'name' ? 'Athlete name' : key === 'event' ? 'Event' : key === 'week' ? 'Week / date' : 'Team'}
              </label>
            ))}
          </div>
        </div>
      )}

      {visibleRows.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <strong>Labels ({outputLabels.length} of {visibleRows.length} selected):</strong>
            <button onClick={() => setDeselectedIds(new Set())} style={miniBtn}>Select all</button>
            <button onClick={() => setDeselectedIds(new Set(flatLabels.map(f => f.id)))} style={miniBtn}>Select none</button>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4, padding: '0.5rem' }}>
            {visibleRows.map(({ id, label: l }) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.15rem 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={!deselectedIds.has(id)} onChange={() => toggleLabel(id)} />
                {'place' in l ? (
                  <span><strong>{l.placeOrdinal}</strong> &middot; #{l.eventNumber} {l.eventDescription} &middot; {l.lastName}, {l.firstName} ({l.age}) &middot; {l.finishTime} &middot; <em>{l.team}</em></span>
                ) : (
                  <span><strong>{l.improvement.toFixed(2)}s</strong> &middot; #{l.eventNumber} {l.eventDescription} &middot; {l.lastName}, {l.firstName} ({l.age}) &middot; PB {l.personalBestTime} &middot; <em>{l.team}</em></span>
                )}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => handleCombineDownload(outputLabels)}
              disabled={combining || outputLabels.length === 0}
              style={{ padding: '0.5rem 1rem', cursor: combining || outputLabels.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              {combining ? 'Generating…' : `Download PDF (${outputLabels.length} label${outputLabels.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}

      {/* ── SwimTopia Top Times ───────────────────────────────────────────── */}
      <hr style={{ margin: '2.5rem 0' }} />
      <SwimTopiaTopTimes />
    </div>
  );
}

/** Small inline "All / None / Select all" action buttons. */
const miniBtn: React.CSSProperties = {
  marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer',
};

/** Per-PDF delete icon button. */
const deleteBtn: React.CSSProperties = {
  marginLeft: '0.75rem', border: 'none', background: 'none', color: '#c00',
  cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem',
};
