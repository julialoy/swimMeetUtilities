import Papa from 'papaparse';

/**
 * An Interface for the result returned by `parseCsv`.
 *
 * @template T - The shape of each parsed row. Defaults to a plain string map
 *   when no type argument is provided.
 */
export interface CsvParseResult<T = Record<string, string>> {
  /** Parsed row objects, keyed by column header. */
  data: T[];
  /** Non-fatal parse warning messages (e.g. mismatched column counts). */
  errors: string[];
  /** Column headers extracted from the first row of the file. */
  fields: string[];
}

/**
 * Parses a CSV `File` object and returns its rows and headers.
 *
 * Uses PapaParse in streaming mode via the browser `File` API. The first row
 * is treated as the header row, and empty lines are skipped automatically.
 *
 * @template T - Optional type to cast each row to. Defaults to `Record<string, string>`.
 * @param file - The CSV file selected or dropped by the user.
 * @returns A promise that always resolves (never rejects) with the parsed data
 *   and any non-fatal error messages.
 *
 * @example
 * const { data, fields, errors } = await parseCsv(file);
 */
export async function parseCsv<T = Record<string, string>>(
  file: File
): Promise<CsvParseResult<T>> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { data: [], errors: ['Failed to read file'], fields: [] };
  }

  return new Promise((resolve) => {
    Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          data: results.data,
          errors: results.errors.map((e) => e.message),
          fields: results.meta.fields ?? [],
        });
      },
    });
  });
}
