/**
 * FontFamily Service - Detects available system fonts
 *
 * PURPOSE
 * ───────
 * Provides a list of available font families for the font selector.
 * Uses the Local Font Access API when available (Chromium browsers),
 * with fallback to a curated list of common fonts.
 *
 * USAGE
 * ─────
 * ```typescript
 * const fonts = await getInstalledFontFamilies();
 * // ['Arial', 'Helvetica', 'Times New Roman', ...]
 * ```
 */

// Cache for font families (avoid repeated API calls)
let cachedFonts: string[] | null = null;

/**
 * Common fonts available on most systems
 * Used as fallback when Local Font Access API is not available
 */
const COMMON_FONTS = [
  // Sans-serif
  'Arial',
  'Helvetica',
  'Helvetica Neue',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
  'Segoe UI',
  'Roboto',
  'Open Sans',
  'Inter',
  'SF Pro',
  'SF Pro Display',

  // Serif
  'Times New Roman',
  'Georgia',
  'Palatino',
  'Garamond',
  'Book Antiqua',
  'Literata',
  'Merriweather',

  // Monospace
  'Courier New',
  'Monaco',
  'Consolas',
  'Menlo',
  'SF Mono',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',

  // System defaults
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
];

/**
 * Font data from Local Font Access API
 */
interface LocalFontData {
  family: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
}

/**
 * Gets available font families
 *
 * Uses the Local Font Access API (Chromium) when available,
 * otherwise returns a fallback list of common fonts.
 *
 * Results are cached for performance.
 *
 * @returns Promise resolving to sorted array of unique font family names
 */
export async function getInstalledFontFamilies(): Promise<string[]> {
  // Return cached result if available
  if (cachedFonts !== null) {
    return cachedFonts;
  }

  // Try Local Font Access API (Chromium 103+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryLocalFonts = (window as any).queryLocalFonts;

  if (typeof queryLocalFonts === 'function') {
    try {
      const fonts: LocalFontData[] = await queryLocalFonts();

      // Extract unique font families
      const families = new Set<string>();
      for (const font of fonts) {
        if (font.family) {
          families.add(font.family);
        }
      }

      // Sort alphabetically
      cachedFonts = Array.from(families).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      return cachedFonts;
    } catch {
      // User denied permission or API failed - fall through to fallback
    }
  }

  // Fallback: return common fonts
  cachedFonts = [...COMMON_FONTS].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  return cachedFonts;
}

/**
 * Clears the font cache
 * Useful for testing or when fonts may have changed
 */
export function clearFontCache(): void {
  cachedFonts = null;
}

/**
 * Checks if Local Font Access API is available
 * @returns true if the API is supported
 */
export function hasLocalFontAccess(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (window as any).queryLocalFonts === 'function';
}
