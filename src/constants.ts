/**
 * @file constants.ts
 * @description Constants - Centralized CSS classes, timing, limits, and magic values
 *
 * PURPOSE
 * ───────
 * Eliminates hardcoded strings and magic numbers scattered throughout the codebase.
 * Provides a single source of truth for all configuration values.
 *
 * **Problem Solved**: Before extraction, rsvp-view.ts and other files contained
 * 50+ magic strings and numbers (e.g., 'dashreader-btn', 300ms delays, min/max limits).
 * This caused:
 * - Inconsistency: Same values duplicated with slight variations
 * - Hard to maintain: Changing a CSS class required finding all occurrences
 * - Error-prone: Typos in string literals only discovered at runtime
 *
 * **Solution**: Centralize all constants in one file:
 * - CSS class names (CSS_CLASSES)
 * - Timing delays (TIMING)
 * - Text length limits (TEXT_LIMITS)
 * - Control increments (INCREMENTS)
 * - Value ranges (LIMITS)
 * - UI icons (ICONS)
 * - Heading multipliers (HEADING_MULTIPLIERS)
 *
 * ARCHITECTURE
 * ────────────
 * **Const Assertions**: All exports use `as const` to:
 * - Make values readonly (TypeScript enforces immutability)
 * - Enable literal type inference (e.g., 'dashreader-btn' not just string)
 * - Provide better IDE autocomplete
 *
 * **Naming Convention**:
 * - ALL_CAPS for exported constant objects
 * - camelCase for properties within objects
 * - Semantic names that describe usage, not implementation
 *
 * **Organization**:
 * Each constant group is organized by domain:
 * - UI structure (CSS_CLASSES)
 * - Behavior timing (TIMING)
 * - Content validation (TEXT_LIMITS)
 * - User interactions (INCREMENTS, LIMITS)
 * - Visual elements (ICONS, HEADING_MULTIPLIERS)
 *
 * OUTLINE
 * ───────
 * ├─ 1. CSS_CLASSES - All CSS class names used in the plugin
 * ├─ 2. TIMING - Delays and durations in milliseconds
 * ├─ 3. TEXT_LIMITS - Minimum text lengths for various operations
 * ├─ 4. INCREMENTS - Default increment/decrement amounts for controls
 * ├─ 5. LIMITS - Min/max ranges for settings
 * ├─ 6. ICONS - Emoji icons for buttons
 * └─ 7. HEADING_MULTIPLIERS - Font size multipliers for markdown headings
 *
 * @version 1.3.1
 * @author DashReader Team
 */

// ============================================================================
// 1. CSS_CLASSES - All CSS class names
// ============================================================================

/**
 * CSS class names used throughout the plugin
 *
 * Centralized to prevent typos and enable consistent styling.
 * When adding new UI elements, add their class names here.
 */
export const CSS_CLASSES = {
  // Main container
  container: 'dashreader-container',

  // Toggle bar
  toggleBar: 'dashreader-toggle-bar',
  toggleBtn: 'dashreader-toggle-btn',

  // Display area
  display: 'dashreader-display',
  word: 'dashreader-word',
  welcome: 'dashreader-welcome',
  highlight: 'dashreader-highlight',

  // Context
  contextBefore: 'dashreader-context-before',
  contextAfter: 'dashreader-context-after',

  // Progress
  progressContainer: 'dashreader-progress-container',
  progressBar: 'dashreader-progress-bar',

  // Controls
  controls: 'dashreader-controls',
  controlGroup: 'dashreader-control-group',
  controlLabel: 'control-label',

  // Settings
  settings: 'dashreader-settings',
  settingGroup: 'dashreader-setting-group',
  settingLabel: 'setting-label',
  settingToggle: 'setting-toggle',

  // Stats
  stats: 'dashreader-stats',
  statsText: 'dashreader-stats-text',
  wpmDisplay: 'dashreader-wpm-display',

  // Buttons
  btn: 'dashreader-btn',
  playBtn: 'play-btn',
  pauseBtn: 'pause-btn',
  smallBtn: 'small-btn',

  // Value displays
  wpmValue: 'wpm-value',
  wpmInlineValue: 'wpm-inline-value',
  chunkValue: 'chunk-value',
  fontValue: 'font-value',
  accelDurationValue: 'accel-duration-value',
  accelTargetValue: 'accel-target-value',

  // State classes
  hidden: 'hidden',
} as const;

// ============================================================================
// 2. TIMING - Delays and durations
// ============================================================================

/**
 * Timing constants in milliseconds
 *
 * Used for delays, debouncing, throttling, and transitions.
 * Balances responsiveness with performance.
 */
export const TIMING = {
  /** Delay before auto-loading content from editor (file-open event) */
  autoLoadDelay: 300,
  /** Shorter delay for leaf-change events (editor already active) */
  autoLoadDelayShort: 200,
  /** Very short delay for immediate operations */
  autoLoadDelayVeryShort: 50,
  /** Throttle interval for cursor/selection checks (prevents excessive checks) */
  throttleDelay: 150,
  /** CSS transition duration for smooth animations */
  transitionDuration: 300,
} as const;

// ============================================================================
// 3. TEXT_LIMITS - Minimum text lengths
// ============================================================================

/**
 * Minimum text lengths for various operations
 *
 * Prevents loading empty or too-short content that wouldn't be useful for reading.
 */
export const TEXT_LIMITS = {
  /** Minimum characters in selection to trigger auto-load */
  minSelectionLength: 30,
  /** Minimum characters in full document to load */
  minContentLength: 50,
  /** Minimum words in parsed text to display */
  minParsedLength: 10,
} as const;

// ============================================================================
// 4. INCREMENTS - Control increment amounts
// ============================================================================

/**
 * Default increment/decrement amounts for controls
 *
 * Used by +/- buttons to adjust values. Values chosen for good UX:
 * - WPM: 25 provides noticeable speed change
 * - Chunk size: 1 for fine-grained control
 * - Font size: 4 for visible but not jarring changes
 * - Accel duration: 5 seconds for practical adjustments
 */
export const INCREMENTS = {
  /** WPM increment (25 = noticeable speed change) */
  wpm: 25,
  /** Chunk size increment (1 word at a time) */
  chunkSize: 1,
  /** Font size increment in pixels (4px = visible change) */
  fontSize: 4,
  /** Acceleration duration increment in seconds */
  accelDuration: 5,
} as const;

// ============================================================================
// 5. LIMITS - Min/max ranges for settings
// ============================================================================

/**
 * Range limits for settings validation
 *
 * Prevents users from setting values that would cause poor UX:
 * - Too fast WPM (>5000) = beyond human capability
 * - Too slow WPM (<50) = frustrating
 * - Font size must fit viewport
 * - Acceleration duration must be practical
 */
export const LIMITS = {
  /** Font size range in pixels (20 = readable minimum, 120 = fills viewport) */
  fontSize: { min: 20, max: 120 },
  /** WPM range (50 = very slow, 5000 = ultra-fast speed reading limit) */
  wpm: { min: 50, max: 5000 },
  /** Acceleration duration in seconds (10 = quick ramp, 120 = gradual) */
  accelDuration: { min: 10, max: 120 },
} as const;

// ============================================================================
// 6. ICONS - Emoji icons for buttons
// ============================================================================

/**
 * Emoji icons used in UI buttons and displays
 *
 * Using emojis provides:
 * - Universal recognition (no localization needed)
 * - No external icon dependencies
 * - Consistent cross-platform appearance
 */
export const ICONS = {
  /** Rewind to start button */
  rewind: '⏮',
  /** Play button */
  play: '▶',
  /** Pause button */
  pause: '⏸',
  /** Skip forward button */
  forward: '⏭',
  /** Stop button */
  stop: '⏹',
  /** Increment (+) button */
  increment: '+',
  /** Decrement (−) button (using minus sign, not hyphen) */
  decrement: '−',
  /** Settings toggle button */
  settings: '⚙️',
  /** Statistics toggle button */
  stats: '📊',
  /** File/document indicator */
  file: '📄',
  /** Celebration (reading complete) */
  celebration: '🎉',
  /** Book/reading indicator */
  book: '📖',
  /** Expand to new tab */
  expand: '⤢',
} as const;

// ============================================================================
// 7. HEADING_MULTIPLIERS - Font size for markdown headings
// ============================================================================

/**
 * Font size multipliers for markdown headings (H1-H6)
 *
 * Applied to base font size when displaying headings during RSVP reading.
 * Provides visual hierarchy that matches markdown document structure.
 *
 * Example: If base font is 48px:
 * - H1 displays at 72px (1.5x)
 * - H2 displays at 62.4px (1.3x)
 * - H3 displays at 57.6px (1.2x)
 * - etc.
 */
export const HEADING_MULTIPLIERS = {
  /** H1 heading multiplier (1.5x base font = major section) */
  h1: 1.5,
  /** H2 heading multiplier (1.3x base font) */
  h2: 1.3,
  /** H3 heading multiplier (1.2x base font) */
  h3: 1.2,
  /** H4 heading multiplier (1.1x base font) */
  h4: 1.1,
  /** H5 heading multiplier (1.05x base font) */
  h5: 1.05,
  /** H6 heading multiplier (1x base font = same as body text) */
  h6: 1.0,
} as const;
