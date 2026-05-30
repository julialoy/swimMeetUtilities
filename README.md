# SwimUtils

A local, browser-based toolkit for working with swim meet files. No data is stored or transmitted — all parsing happens in your browser.

## What it does

| File type | What SwimUtils does with it |
|---|---|
| `.hy3` | Parses a HyTek Meet Manager → Team Manager Results export into structured meet data (teams, swimmers, individual entries, DQ flags) |
| `.csv` | Parses a SwimTopia athlete report card export into per-athlete event summaries with improvement tracking |
| Award labels `.pdf` | Parses an Avery 8160 award labels PDF, previews the labels, and lets you download a regenerated copy |
| Improvement labels `.pdf` | Parses an Avery 8160 personal-best/improvement labels PDF |

**Combine & Reorder:** Upload multiple award label PDFs, sort the combined label set by athlete name, event number, or meet date, and download a single merged PDF.

## Tech stack

- React 19 + TypeScript 5.9 + Vite 8
- [pdfjs-dist](https://mozilla.github.io/pdf.js/) — PDF text extraction
- [pdf-lib](https://pdf-lib.js.org/) — PDF generation
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [Vitest](https://vitest.dev/) — test runner

## Running locally

```sh
npm install
npm run dev      # development server at http://localhost:5173
npm test         # run all tests (88 passing)
npm run build    # production build → dist/
```

## Project structure

```
src/
  parsers/       # File parsers — see src/parsers/README.md
  generators/    # PDF generators (award labels via pdf-lib)
  utils/         # Sorting and other utilities
  components/    # React UI components
  types/         # Shared TypeScript interfaces
```

See [`src/parsers/README.md`](src/parsers/README.md) for a full description of each parser, its expected input format, and its return type.
