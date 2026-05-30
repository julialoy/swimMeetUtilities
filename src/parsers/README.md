# Parsers

Each parser accepts a browser `File` object and returns a typed result object. All parsing is done locally — no data leaves the browser.

---

## File overview

| File | Purpose |
|---|---|
| `csvParser.ts` | Generic CSV → row objects (PapaParse wrapper) |
| `hy3TmResultsParser.ts` | HyTek Team Manager Results export `.hy3` → structured meet data |
| `swimTopiaParser.ts` | SwimTopia athlete report card `.csv` → athlete/event summaries |
| `pdfParser.ts` | Generic PDF → plain text (not column-aware; for simple PDFs) |
| `pdfLabelUtils.ts` | Shared column-reconstruction utilities for Avery 8160 label PDFs |
| `awardLabelsParser.ts` | Award labels PDF → `AwardLabel[]` (thin wrapper around `parseLabelsPdf`) |
| `awardLabelLineParser.ts` | Pure line-parsing logic for award labels (no pdfjs-dist dependency) |
| `improvementLabelsParser.ts` | Improvement/personal-best labels PDF → `ImprovementLabel[]` (thin wrapper around `parseLabelsPdf`) |
| `improvementLabelLineParser.ts` | Pure line-parsing logic for improvement labels (no pdfjs-dist dependency) |
| `labelParser.ts` | Auto-detecting label PDF parser → `Label[]` (single pdfjs-dist pass, handles both types) |

---

## Parsers

### `csvParser.ts` — `parseCsv<T>(file)`

Generic PapaParse wrapper. Reads the file as text first.

```ts
const { data, fields, errors } = await parseCsv(file);
```

Returns `{ data: T[], fields: string[], errors: string[] }`.

---

### `hy3TmResultsParser.ts` — `parseHy3(file)`

Parses a **HyTek Meet Manager → Team Manager Results** `.hy3` export. Handles the TM Results export variant.

Supported record types:

| Record | Content |
|---|---|
| `B1` | Meet name, facility, start/end dates |
| `B2` | Meet subtitle |
| `C1` | Team code, full name, short name, LSC |
| `D1` | Swimmer identity (name, gender, DOB, age, preferred name) |
| `E1` | Individual event entry (event code, age group, seed/finish time, place, points) |
| `E2` | Supplemental event info — DQ flag |

All other record types (relays, split records, file terminator) are silently ignored as they are not needed for this use case.

```ts
const { meet, errors } = await parseHy3(file);
// meet: ParsedMeet | null
// errors: string[]  (non-fatal per-line warnings)
```


---

### `swimTopiaParser.ts` — `parseSwimTopiaReportCard(file)`

Parses a **SwimTopia athlete report card** CSV export. The file is in wide format: each row is one athlete × one event, and assumes up to 17 meet result columns (`Meet1-Name` … `Meet17-Points`) for a standard summer swim league season. Rows with the same `AthleteId` are collapsed into a single `SwimTopiaAthlete`.

```ts
const { athletes, errors } = await parseSwimTopiaReportCard(file);
// athletes: SwimTopiaAthlete[]
// errors: string[]
```

---

### `pdfParser.ts` — `parsePdf(file)`

Generic plain-text extractor. Concatenates all text items from each page in PDF stream order. **Does not reconstruct column layout** — use `awardLabelsParser` or `improvementLabelsParser` for multi-column label PDFs.

```ts
const { pages, text, error } = await parsePdf(file);
```

---

### `awardLabelsParser.ts` — `parseAwardLabelsPdf(file)`

Parses an **Avery 8160 award labels PDF** (3 columns × 10 rows per US letter page). This is the standard Award Label format produced by Meet Manager and SwimTopia's Meet Maestro. Each label has 5 lines:

```
{place} Place Time: {finishTime}
#{eventNumber} {eventDescription}
{lastName}, {firstName} ({age})
{team} – {date}
{meetName}
```

Thin wrapper around `parseLabelsPdf` — supplies the `PLACE_LINE_RE` boundary predicate and `awardLabelLineParser.parseLabelLines`.

```ts
const { labels, errors } = await parseAwardLabelsPdf(file);
// labels: AwardLabel[]
```

---

### `improvementLabelsParser.ts` — `parseImprovementLabelsPdf(file)`

Parses an **Avery 8160 improvement/personal-best labels PDF** (same 3×10 layout). This is the standard Improvement Label format produced by Meet Manager and SwimTopia's Meet Maestro. Each label has 5 lines:

```
#{eventNumber} {eventDescription}
{lastName}, {firstName} ({age})
Personal Best: {time} ({improvement})
{team} – {date}
{meetName}
```

Note the different line order from award labels — the event line is first, which is also the block boundary marker. Thin wrapper around `parseLabelsPdf` — supplies the `EVENT_START_RE` boundary predicate and `improvementLabelLineParser.parseLabelLines`.

```ts
const { labels, errors } = await parseImprovementLabelsPdf(file);
// labels: ImprovementLabel[]
```

---

### `labelParser.ts` — `parseAnyLabelsPdf(file)`

Parses any Avery 8160 label PDF in a **single pdfjs-dist pass**, auto-detecting whether each label block is an award label or improvement label by matching against both boundary patterns and trying both line parsers. A single PDF may contain a mix of both label types.

Use this instead of calling both typed parsers separately — it avoids redundant PDF loading and reconstruction work.

```ts
const { labels, errors } = await parseAnyLabelsPdf(file);
// labels: Label[]  (AwardLabel | ImprovementLabel)
```

---

## Shared utilities

### `pdfLabelUtils.ts`

Column-reconstruction helpers shared by both label parsers. Avery 8160 labels on US letter paper produce a 3-column layout (col boundaries at x ≈ 204 and 408 PDF points). Because pdf.js may return text items in stream order rather than visual order, these utilities re-derive reading order from x/y coordinates.

| Export | Description |
|---|---|
| `isTextItem(item)` | Type guard — filters pdf.js items that carry a `str` field |
| `getColumn(x)` | Maps an x-coordinate to column index 0, 1, or 2 |
| `toPhysicalLines(items)` | Groups items into top-to-bottom lines, split into 3 column buckets |
| `toBlocks(lines, isBoundary)` | Splits lines into label-row blocks using a per-column predicate |
| `parseLabelsPdf<T>(file, isBoundary, parseLines)` | Complete single-pass parsing pipeline; used by all label parsers |

`toBlocks` and `parseLabelsPdf` accept an `isBoundary` predicate so each parser defines its own first-line pattern:
- Award labels: `/\b\w+\s+Place\s+Time:/i` (place/time line is first)
- Improvement labels: `/^#\w+\s+/` (event number line is first)

Note: a combined boundary cannot be used for mixed-type detection because award labels contain a `#event` line as their *second* line, which would be mistaken for an improvement-label boundary. `labelParser` avoids this by detecting type once from the first page and applying a single-type boundary for the whole file.

### `awardLabelLineParser.ts` / `improvementLabelLineParser.ts`

Pure functions with no pdfjs-dist dependency. Called by their respective typed parsers and by `labelParser.ts` (which tries both in sequence for auto-detection).

```ts
parseLabelLines(lines: string[]): AwardLabel | null
parseLabelLines(lines: string[]): ImprovementLabel | null
```

Returns `null` if any line is empty or fails its regex.
