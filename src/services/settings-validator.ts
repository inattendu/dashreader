/**
 * SettingsValidator - Validates and sanitizes plugin settings
 *
 * PURPOSE
 * ───────
 * Ensures all settings loaded from data.json are valid and within acceptable ranges.
 * Prevents crashes from corrupted settings, invalid values, or missing properties.
 *
 * KEY RESPONSIBILITIES
 * ────────────────────
 * - Validate numeric ranges (WPM, fontSize, multipliers, etc.)
 * - Validate color formats (hex colors)
 * - Apply default values for missing properties
 * - Clamp out-of-range values instead of rejecting them
 * - Silent validation (no console logs per Obsidian guidelines)
 *
 * USAGE
 * ─────
 * ```typescript
 * // In plugin onload()
 * const rawSettings = await this.loadData();
 * const validSettings = validateSettings(rawSettings);
 * ```
 */

import { DashReaderSettings, DEFAULT_SETTINGS } from '../types';

/**
 * Validation limits for numeric settings
 */
const LIMITS = {
  wpm: { min: 50, max: 5000 },
  chunkSize: { min: 1, max: 10 },
  fontSize: { min: 12, max: 120 },
  contextWords: { min: 0, max: 20 },
  autoStartDelay: { min: 0, max: 60 },
  accelerationDuration: { min: 1, max: 300 },
  accelerationTargetWpm: { min: 50, max: 5000 },
  micropauseMultiplier: { min: 1.0, max: 10.0 }
} as const;

/**
 * Clamps a number between min and max values
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates a hex color string (#RRGGBB or #RGB)
 * Returns the color if valid, otherwise returns the default
 */
function validateColor(color: unknown, defaultColor: string): string {
  if (typeof color !== 'string') return defaultColor;

  // Match #RGB or #RRGGBB format
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) {
    return color;
  }

  return defaultColor;
}

/**
 * Validates a number and clamps it to the specified range
 */
function validateNumber(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return defaultValue;
  }
  return clamp(value, min, max);
}

/**
 * Validates a boolean value
 */
function validateBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

/**
 * Validates a string value
 */
function validateString(value: unknown, defaultValue: string): string {
  if (typeof value === 'string') return value;
  return defaultValue;
}

/**
 * Validates and sanitizes DashReader settings
 *
 * @param partial - Partial settings object loaded from data.json
 * @returns Fully valid DashReaderSettings with defaults applied
 *
 * @example
 * ```typescript
 * const rawSettings = await this.loadData();
 * const validSettings = validateSettings(rawSettings);
 * this.settings = validSettings;
 * ```
 */
export function validateSettings(partial: Partial<DashReaderSettings> | null | undefined): DashReaderSettings {
  // Handle null/undefined by returning defaults
  if (!partial || typeof partial !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    // Numeric settings with range validation
    wpm: validateNumber(
      partial.wpm,
      DEFAULT_SETTINGS.wpm,
      LIMITS.wpm.min,
      LIMITS.wpm.max
    ),
    chunkSize: validateNumber(
      partial.chunkSize,
      DEFAULT_SETTINGS.chunkSize,
      LIMITS.chunkSize.min,
      LIMITS.chunkSize.max
    ),
    fontSize: validateNumber(
      partial.fontSize,
      DEFAULT_SETTINGS.fontSize,
      LIMITS.fontSize.min,
      LIMITS.fontSize.max
    ),
    contextWords: validateNumber(
      partial.contextWords,
      DEFAULT_SETTINGS.contextWords,
      LIMITS.contextWords.min,
      LIMITS.contextWords.max
    ),
    autoStartDelay: validateNumber(
      partial.autoStartDelay,
      DEFAULT_SETTINGS.autoStartDelay,
      LIMITS.autoStartDelay.min,
      LIMITS.autoStartDelay.max
    ),
    accelerationDuration: validateNumber(
      partial.accelerationDuration,
      DEFAULT_SETTINGS.accelerationDuration,
      LIMITS.accelerationDuration.min,
      LIMITS.accelerationDuration.max
    ),
    accelerationTargetWpm: validateNumber(
      partial.accelerationTargetWpm,
      DEFAULT_SETTINGS.accelerationTargetWpm,
      LIMITS.accelerationTargetWpm.min,
      LIMITS.accelerationTargetWpm.max
    ),

    // Micropause multipliers
    micropausePunctuation: validateNumber(
      partial.micropausePunctuation,
      DEFAULT_SETTINGS.micropausePunctuation,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseOtherPunctuation: validateNumber(
      partial.micropauseOtherPunctuation,
      DEFAULT_SETTINGS.micropauseOtherPunctuation,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseLongWords: validateNumber(
      partial.micropauseLongWords,
      DEFAULT_SETTINGS.micropauseLongWords,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseParagraph: validateNumber(
      partial.micropauseParagraph,
      DEFAULT_SETTINGS.micropauseParagraph,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseNumbers: validateNumber(
      partial.micropauseNumbers,
      DEFAULT_SETTINGS.micropauseNumbers,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseSectionMarkers: validateNumber(
      partial.micropauseSectionMarkers,
      DEFAULT_SETTINGS.micropauseSectionMarkers,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseListBullets: validateNumber(
      partial.micropauseListBullets,
      DEFAULT_SETTINGS.micropauseListBullets,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),
    micropauseCallouts: validateNumber(
      partial.micropauseCallouts,
      DEFAULT_SETTINGS.micropauseCallouts,
      LIMITS.micropauseMultiplier.min,
      LIMITS.micropauseMultiplier.max
    ),

    // Color settings
    highlightColor: validateColor(partial.highlightColor, DEFAULT_SETTINGS.highlightColor),
    backgroundColor: validateColor(partial.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
    fontColor: validateColor(partial.fontColor, DEFAULT_SETTINGS.fontColor),

    // String settings
    fontFamily: validateString(partial.fontFamily, DEFAULT_SETTINGS.fontFamily),
    hotkeyPlay: validateString(partial.hotkeyPlay, DEFAULT_SETTINGS.hotkeyPlay),
    hotkeyRewind: validateString(partial.hotkeyRewind, DEFAULT_SETTINGS.hotkeyRewind),
    hotkeyForward: validateString(partial.hotkeyForward, DEFAULT_SETTINGS.hotkeyForward),
    hotkeyIncrementWpm: validateString(partial.hotkeyIncrementWpm, DEFAULT_SETTINGS.hotkeyIncrementWpm),
    hotkeyDecrementWpm: validateString(partial.hotkeyDecrementWpm, DEFAULT_SETTINGS.hotkeyDecrementWpm),
    hotkeyQuit: validateString(partial.hotkeyQuit, DEFAULT_SETTINGS.hotkeyQuit),

    // Boolean settings
    showContext: validateBoolean(partial.showContext, DEFAULT_SETTINGS.showContext),
    showMinimap: validateBoolean(partial.showMinimap, DEFAULT_SETTINGS.showMinimap),
    showBreadcrumb: validateBoolean(partial.showBreadcrumb, DEFAULT_SETTINGS.showBreadcrumb),
    enableMicropause: validateBoolean(partial.enableMicropause, DEFAULT_SETTINGS.enableMicropause),
    autoStart: validateBoolean(partial.autoStart, DEFAULT_SETTINGS.autoStart),
    showProgress: validateBoolean(partial.showProgress, DEFAULT_SETTINGS.showProgress),
    showStats: validateBoolean(partial.showStats, DEFAULT_SETTINGS.showStats),
    enableSlowStart: validateBoolean(partial.enableSlowStart, DEFAULT_SETTINGS.enableSlowStart),
    enableAcceleration: validateBoolean(partial.enableAcceleration, DEFAULT_SETTINGS.enableAcceleration),
  };
}
