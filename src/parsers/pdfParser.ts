import * as pdfjsLib from 'pdfjs-dist';

// pdf.js offloads heavy rendering work to a Web Worker. We point it at the
// bundled worker file so Vite can resolve and bundle it correctly at build time.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/** An Interface for the result returned by `parsePdf`. */
export interface PdfParseResult {
  /** Extracted text for each page, in page order. */
  pages: string[];
  /** All pages concatenated with newline separators, for full-document search. */
  text: string;
  /** Present only if the file could not be parsed (e.g. encrypted or corrupted PDF). */
  error?: string;
}

/**
 * Extracts plain text content from a PDF `File` object, page by page.
 *
 * Flow:
 * 1. Reads the file as an `ArrayBuffer` (required by pdf.js).
 * 2. Loads the PDF document via the pdf.js Web Worker.
 * 3. Iterates each page and concatenates its text content items into a string.
 * 4. Returns all pages and a combined full-text string.
 *
 * Note: Text extraction is positional &mdash;pdf.js joins text items in the order
 * they appear in the PDF stream, which may differ from visual reading order
 * for complex layouts (e.g. multi-column results sheets).
 *
 * @param file - The PDF file selected or dropped by the user.
 * @returns A promise that always resolves with extracted text or an error message.
 */
export async function parsePdf(file: File): Promise<PdfParseResult> {
  try {
    // pdf.js requires raw binary data, not a Blob or object URL
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    // pdf.js pages are 1-indexed
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Each item in the content stream is either a text chunk ('str') or a
      // transform marker. We only collect items that carry a 'str' property.
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      pages.push(pageText);
    }

    return { pages, text: pages.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PDF error';
    return { pages: [], text: '', error: message };
  }
}
