/**
 * Some meet-software label PDFs embed a font whose ToUnicode map renders every
 * lowercase "f" as U+03D0 (the Greek beta symbol, "ϐ"). Uppercase "F" is
 * unaffected. This shows up in event names ("Butterϐly") and swimmer names
 * ("Soϐia", "Crutchϐield", "Weisϐlog").
 *
 * The mapping is consistent — ϐ is always a lowercase "f" — so it can be
 * reversed safely everywhere. U+03D0 never legitimately appears in award or
 * improvement label text, so a blanket replacement is safe.
 */
const LIGATURE = 'ϐ';

/** Restores lowercase "f" wherever the font emitted the U+03D0 substitute. */
export function resolveLigatures(text: string): string {
  return text.replace(/ϐ/g, 'f');
}

export { LIGATURE };
