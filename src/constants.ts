/**
 * Constants - Centralized CSS classes, delays, and magic values
 *
 * Eliminates hardcoded strings scattered throughout the codebase.
 */

/**
 * CSS Class names
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

/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  autoLoadDelay: 300,
  autoLoadDelayShort: 200,
  autoLoadDelayVeryShort: 50,
  throttleDelay: 150,
  transitionDuration: 300,
} as const;

/**
 * Minimum text lengths
 */
export const TEXT_LIMITS = {
  minSelectionLength: 30,
  minContentLength: 50,
  minParsedLength: 10,
} as const;

/**
 * Default increments for controls
 */
export const INCREMENTS = {
  wpm: 25,
  chunkSize: 1,
  fontSize: 4,
  accelDuration: 5,
} as const;

/**
 * Range limits
 */
export const LIMITS = {
  fontSize: { min: 20, max: 120 },
  wpm: { min: 50, max: 1000 },
  accelDuration: { min: 10, max: 120 },
} as const;

/**
 * Button icons (emojis)
 */
export const ICONS = {
  rewind: '⏮',
  play: '▶',
  pause: '⏸',
  forward: '⏭',
  stop: '⏹',
  increment: '+',
  decrement: '−',
  settings: '⚙️',
  stats: '📊',
  file: '📄',
  celebration: '🎉',
  book: '📖',
} as const;

/**
 * Heading font size multipliers
 */
export const HEADING_MULTIPLIERS = {
  h1: 2.0,
  h2: 1.75,
  h3: 1.5,
  h4: 1.25,
  h5: 1.1,
  h6: 1.0,
} as const;
