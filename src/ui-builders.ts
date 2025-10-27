/**
 * @file ui-builders.ts
 * @description Reusable UI component factories for DashReader
 *
 * PURPOSE:
 * Provides a collection of factory functions for building consistent,
 * reusable UI components. Eliminates 150+ lines of duplicated control-building
 * code across the view, enforcing consistent styling and behavior.
 *
 * DESIGN PRINCIPLES:
 * - Configuration objects over multiple parameters
 * - Optional DOM registry integration for automatic updates
 * - Consistent return types (container + specific elements)
 * - HTML escaping by default for XSS prevention
 * - CSS class constants for styling consistency
 *
 * OUTLINE:
 * ├─ 1. IMPORTS & TYPE DEFINITIONS
 * │  ├─ Configuration interfaces
 * │  └─ Return type interfaces
 * ├─ 2. BASIC UI COMPONENTS
 * │  ├─ createButton() - Icon buttons
 * │  ├─ createNumberControl() - Increment/decrement controls
 * │  └─ createToggleControl() - Checkbox toggles
 * ├─ 3. PLAYBACK CONTROLS
 * │  ├─ createPlayPauseButtons() - Dual button for play/pause
 * │  └─ updatePlayPauseButtons() - Update button visibility
 * ├─ 4. ADVANCED UI COMPONENTS
 * │  ├─ createSlider() - Range input with value display
 * │  ├─ createDropdown() - Select/option picker
 * │  └─ createButtonGroup() - Radio buttons styled as buttons
 * ├─ 5. UTILITY FUNCTIONS
 * │  ├─ formatTime() - MM:SS formatting
 * │  ├─ escapeHtml() - XSS prevention
 * │  ├─ createWelcomeMessage() - Initial message HTML
 * │  └─ createReadyMessage() - Pre-reading state HTML
 * └─ 6. LEGACY UTILITIES
 *    └─ togglePanel() - Panel visibility helper
 *
 * @author DashReader Team
 * @version 2.0.0 - Refactored with advanced builders
 */

// ============================================================================
// SECTION 1: IMPORTS & TYPE DEFINITIONS
// ============================================================================

import { CSS_CLASSES, ICONS } from './constants';
import { DOMRegistry } from './dom-registry';

// ──────────────────────────────────────────────────────────────────────
// Button Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a button
 */
export interface ButtonConfig {
  /** Icon or emoji to display */
  icon: string;
  /** Tooltip text */
  title: string;
  /** Click handler */
  onClick: () => void;
  /** Optional additional CSS class */
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Number Control Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a number control (increment/decrement)
 */
export interface NumberControlConfig {
  /** Label text (e.g., "WPM: ") */
  label: string;
  /** Current value */
  value: number;
  /** Handler for increment button */
  onIncrement: () => void;
  /** Handler for decrement button */
  onDecrement: () => void;
  /** Increment amount (for tooltip) */
  increment?: number;
  /** Key for DOM registry auto-update */
  registryKey?: string;
  /** Custom icon for decrement button */
  decrementIcon?: string;
  /** Custom icon for increment button */
  incrementIcon?: string;
  /** Custom tooltip for decrement button */
  decrementTitle?: string;
  /** Custom tooltip for increment button */
  incrementTitle?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Toggle Control Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a toggle (checkbox)
 */
export interface ToggleControlConfig {
  /** Label text */
  label: string;
  /** Initial checked state */
  checked: boolean;
  /** Handler when value changes */
  onChange: (checked: boolean) => void;
}

// ──────────────────────────────────────────────────────────────────────
// Conditional Group Configuration (Legacy)
// ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for conditional visibility groups
 * @deprecated Use direct style.display manipulation instead
 */
export interface ConditionalGroupConfig {
  condition: boolean;
  groups: HTMLElement[];
}

// ──────────────────────────────────────────────────────────────────────
// Slider Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a range slider
 */
export interface SliderConfig {
  /** Label text */
  label: string;
  /** Current value */
  value: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Handler when value changes */
  onChange: (value: number) => void;
  /** Key for DOM registry auto-update */
  registryKey?: string;
  /** Whether to show value display (default: true) */
  showValue?: boolean;
  /** Unit to append to value (e.g., "px", "WPM") */
  unit?: string;
}

// ──────────────────────────────────────────────────────────────────────
// Dropdown Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Single option in a dropdown
 */
export interface DropdownOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
}

/**
 * Configuration for creating a dropdown/select
 */
export interface DropdownConfig {
  /** Label text */
  label: string;
  /** Available options */
  options: DropdownOption[];
  /** Currently selected value */
  value: string;
  /** Handler when selection changes */
  onChange: (value: string) => void;
}

// ──────────────────────────────────────────────────────────────────────
// Button Group Configuration
// ──────────────────────────────────────────────────────────────────────

/**
 * Single button in a button group
 */
export interface ButtonGroupOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional icon/emoji */
  icon?: string;
}

/**
 * Configuration for creating a button group (radio buttons as buttons)
 */
export interface ButtonGroupConfig {
  /** Label text */
  label: string;
  /** Available options */
  options: ButtonGroupOption[];
  /** Currently selected value */
  value: string;
  /** Handler when selection changes */
  onChange: (value: string) => void;
}

// ============================================================================
// SECTION 2: BASIC UI COMPONENTS
// ============================================================================

/**
 * Creates a button element with consistent styling
 *
 * Creates an icon button with Obsidian-compatible styling and event handling.
 * Used throughout the UI for actions like play, pause, rewind, etc.
 *
 * @param parent - Parent element to append button to
 * @param config - Button configuration
 * @returns Created button element
 *
 * @example
 * ```typescript
 * createButton(container, {
 *   icon: ICONS.play,
 *   title: 'Play (Shift+Space)',
 *   onClick: () => engine.play(),
 *   className: 'play-btn'
 * });
 * ```
 */
export function createButton(
  parent: HTMLElement,
  config: ButtonConfig
): HTMLButtonElement {
  const className = config.className
    ? `${CSS_CLASSES.btn} ${config.className}`
    : CSS_CLASSES.btn;

  const btn = parent.createEl('button', {
    text: config.icon,
    cls: className,
    attr: { title: config.title }
  });

  btn.addEventListener('click', config.onClick);
  return btn;
}

/**
 * Creates a number control with increment/decrement buttons
 *
 * Builds a control group with label, decrement button, value display, and
 * increment button. Commonly used for WPM, font size, chunk size controls.
 * Eliminates ~30 lines of duplicated code per control.
 *
 * @param parent - Parent element to append control to
 * @param config - Number control configuration
 * @param registry - Optional DOM registry for auto-update
 * @returns Object with container and value element
 *
 * @example
 * ```typescript
 * createNumberControl(panel, {
 *   label: 'WPM: ',
 *   value: 300,
 *   onIncrement: () => changeWpm(25),
 *   onDecrement: () => changeWpm(-25),
 *   registryKey: 'wpmValue'
 * }, domRegistry);
 * ```
 */
export function createNumberControl(
  parent: HTMLElement,
  config: NumberControlConfig,
  registry?: DOMRegistry
): { container: HTMLElement; valueEl: HTMLElement } {
  const container = parent.createDiv({ cls: CSS_CLASSES.controlGroup });

  // Label
  container.createEl('span', {
    text: config.label,
    cls: CSS_CLASSES.controlLabel
  });

  // Decrement button
  createButton(container, {
    icon: config.decrementIcon || ICONS.decrement,
    title: config.decrementTitle || `Decrease (${config.increment || 1})`,
    onClick: config.onDecrement,
    className: CSS_CLASSES.smallBtn
  });

  // Value display
  const valueEl = container.createEl('span', {
    text: String(config.value),
    cls: config.registryKey || 'value-display'
  });

  // Register in DOM registry if key provided
  if (config.registryKey && registry) {
    registry.register(config.registryKey as any, valueEl);
  }

  // Increment button
  createButton(container, {
    icon: config.incrementIcon || ICONS.increment,
    title: config.incrementTitle || `Increase (+${config.increment || 1})`,
    onClick: config.onIncrement,
    className: CSS_CLASSES.smallBtn
  });

  return { container, valueEl };
}

/**
 * Creates a toggle control (checkbox with label)
 *
 * Builds a labeled checkbox for boolean settings. Used for enabling/disabling
 * features like context display, micropause, acceleration, etc.
 *
 * @param parent - Parent element to append toggle to
 * @param config - Toggle configuration
 * @returns Object with container and checkbox element
 *
 * @example
 * ```typescript
 * createToggleControl(panel, {
 *   label: 'Show context',
 *   checked: settings.showContext,
 *   onChange: (checked) => {
 *     settings.showContext = checked;
 *     updateContextDisplay();
 *   }
 * });
 * ```
 */
export function createToggleControl(
  parent: HTMLElement,
  config: ToggleControlConfig
): { container: HTMLElement; checkbox: HTMLInputElement } {
  const container = parent.createDiv({ cls: CSS_CLASSES.settingGroup });
  const toggle = container.createEl('label', { cls: CSS_CLASSES.settingToggle });
  const checkbox = toggle.createEl('input', { type: 'checkbox' });

  checkbox.checked = config.checked;
  checkbox.addEventListener('change', () => {
    config.onChange(checkbox.checked);
  });

  toggle.createEl('span', { text: ` ${config.label}` });

  return { container, checkbox };
}

// ============================================================================
// SECTION 3: PLAYBACK CONTROLS
// ============================================================================

/**
 * Creates play and pause buttons with visibility toggle
 *
 * Creates two buttons (play and pause) that toggle visibility based on
 * playback state. Only one is visible at a time.
 *
 * @param parent - Parent element to append buttons to
 * @param onPlay - Handler for play button click
 * @param onPause - Handler for pause button click
 * @param registry - DOM registry for button references
 *
 * @example
 * ```typescript
 * createPlayPauseButtons(
 *   controlsPanel,
 *   () => engine.play(),
 *   () => engine.pause(),
 *   domRegistry
 * );
 * ```
 */
export function createPlayPauseButtons(
  parent: HTMLElement,
  onPlay: () => void,
  onPause: () => void,
  registry: DOMRegistry
): void {
  const playBtn = createButton(parent, {
    icon: ICONS.play,
    title: 'Play (Shift+Space)',
    onClick: onPlay,
    className: CSS_CLASSES.playBtn
  });

  const pauseBtn = createButton(parent, {
    icon: ICONS.pause,
    title: 'Pause (Shift+Space)',
    onClick: onPause,
    className: `${CSS_CLASSES.pauseBtn} ${CSS_CLASSES.hidden}`
  });

  registry.register('playBtn', playBtn);
  registry.register('pauseBtn', pauseBtn);
}

/**
 * Updates play/pause button visibility based on playing state
 *
 * Shows pause button when playing, shows play button when paused.
 *
 * @param registry - DOM registry containing button references
 * @param isPlaying - Whether currently playing
 *
 * @example
 * ```typescript
 * updatePlayPauseButtons(domRegistry, engine.isPlaying());
 * ```
 */
export function updatePlayPauseButtons(
  registry: DOMRegistry,
  isPlaying: boolean
): void {
  registry.toggleClass('playBtn', CSS_CLASSES.hidden, isPlaying);
  registry.toggleClass('pauseBtn', CSS_CLASSES.hidden, !isPlaying);
}

// ============================================================================
// SECTION 4: ADVANCED UI COMPONENTS
// ============================================================================

/**
 * Creates a range slider control with optional value display
 *
 * Builds a slider (HTML5 range input) with label and optional value display.
 * Useful for smooth value adjustments like WPM, font size, etc.
 * Provides better UX than increment/decrement buttons for large ranges.
 *
 * @param parent - Parent element to append slider to
 * @param config - Slider configuration
 * @param registry - Optional DOM registry for auto-update
 * @returns Object with container, slider, and optional value element
 *
 * @example
 * ```typescript
 * createSlider(panel, {
 *   label: 'Font Size: ',
 *   value: 48,
 *   min: 20,
 *   max: 120,
 *   step: 4,
 *   unit: 'px',
 *   onChange: (val) => updateFontSize(val)
 * }, domRegistry);
 * ```
 */
export function createSlider(
  parent: HTMLElement,
  config: SliderConfig,
  registry?: DOMRegistry
): { container: HTMLElement; slider: HTMLInputElement; valueEl?: HTMLElement } {
  const container = parent.createDiv({ cls: CSS_CLASSES.settingGroup });

  // Label
  container.createEl('span', {
    text: config.label,
    cls: CSS_CLASSES.settingLabel
  });

  // Slider
  const slider = container.createEl('input', {
    type: 'range',
    attr: {
      min: String(config.min),
      max: String(config.max),
      step: String(config.step || 1),
      value: String(config.value)
    }
  });
  slider.classList.add('dashreader-slider');

  // Value display (optional)
  let valueEl: HTMLElement | undefined;
  if (config.showValue !== false) {
    const unit = config.unit || '';
    valueEl = container.createEl('span', {
      text: `${config.value}${unit}`,
      cls: config.registryKey || 'slider-value'
    });

    if (config.registryKey && registry) {
      registry.register(config.registryKey as any, valueEl);
    }
  }

  // Event handler
  slider.addEventListener('input', () => {
    const newValue = parseInt(slider.value);
    config.onChange(newValue);
    if (valueEl) {
      const unit = config.unit || '';
      valueEl.setText(`${newValue}${unit}`);
    }
  });

  return { container, slider, valueEl };
}

/**
 * Creates a dropdown/select control
 *
 * Builds a labeled select element for choosing from predefined options.
 * Useful for preset selection, theme selection, reading modes, etc.
 *
 * @param parent - Parent element to append dropdown to
 * @param config - Dropdown configuration
 * @returns Object with container and select element
 *
 * @example
 * ```typescript
 * createDropdown(panel, {
 *   label: 'Speed Preset: ',
 *   options: [
 *     { value: '200', label: 'Slow (200 WPM)' },
 *     { value: '300', label: 'Normal (300 WPM)' },
 *     { value: '500', label: 'Fast (500 WPM)' }
 *   ],
 *   value: '300',
 *   onChange: (val) => setWpmPreset(parseInt(val))
 * });
 * ```
 */
export function createDropdown(
  parent: HTMLElement,
  config: DropdownConfig
): { container: HTMLElement; select: HTMLSelectElement } {
  const container = parent.createDiv({ cls: CSS_CLASSES.settingGroup });

  // Label
  container.createEl('span', {
    text: config.label,
    cls: CSS_CLASSES.settingLabel
  });

  // Select element
  const select = container.createEl('select', {
    cls: 'dashreader-dropdown'
  });

  // Add options
  config.options.forEach(option => {
    const optionEl = select.createEl('option', {
      value: option.value,
      text: option.label
    });
    if (option.value === config.value) {
      optionEl.selected = true;
    }
  });

  // Event handler
  select.addEventListener('change', () => {
    config.onChange(select.value);
  });

  return { container, select };
}

/**
 * Creates a button group (radio buttons styled as buttons)
 *
 * Builds a group of buttons that act like radio buttons - only one can be
 * active at a time. Used for mode selection (chunk size presets, reading
 * speeds, layouts, etc.). Provides better UX than traditional radio buttons.
 *
 * @param parent - Parent element to append button group to
 * @param config - Button group configuration
 * @returns Object with container and array of button elements
 *
 * @example
 * ```typescript
 * createButtonGroup(panel, {
 *   label: 'Reading Mode: ',
 *   options: [
 *     { value: '1', label: 'Single', icon: '📖' },
 *     { value: '3', label: 'Phrase', icon: '📝' },
 *     { value: '5', label: 'Sentence', icon: '📄' }
 *   ],
 *   value: '1',
 *   onChange: (val) => setChunkSize(parseInt(val))
 * });
 * ```
 */
export function createButtonGroup(
  parent: HTMLElement,
  config: ButtonGroupConfig
): { container: HTMLElement; buttons: HTMLButtonElement[] } {
  const container = parent.createDiv({ cls: CSS_CLASSES.settingGroup });

  // Label
  container.createEl('span', {
    text: config.label,
    cls: CSS_CLASSES.settingLabel
  });

  // Button group container
  const groupContainer = container.createDiv({ cls: 'dashreader-button-group' });

  // Create buttons
  const buttons = config.options.map(option => {
    const btn = groupContainer.createEl('button', {
      text: option.icon ? `${option.icon} ${option.label}` : option.label,
      cls: 'dashreader-group-btn'
    });

    if (option.value === config.value) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      // Remove active from all buttons
      buttons.forEach(b => b.classList.remove('active'));
      // Add active to clicked button
      btn.classList.add('active');
      // Trigger onChange
      config.onChange(option.value);
    });

    return btn;
  });

  return { container, buttons };
}

// ============================================================================
// SECTION 5: UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats seconds into MM:SS format
 *
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "3:45")
 *
 * @example
 * ```typescript
 * formatTime(225) // "3:45"
 * formatTime(65)  // "1:05"
 * formatTime(5)   // "0:05"
 * ```
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escapes HTML characters to prevent XSS attacks
 *
 * SECURITY: Always use this when displaying user-generated content or
 * content from notes, as Obsidian notes can contain HTML/script tags.
 *
 * @param text - Text to escape
 * @returns HTML-safe text
 *
 * @example
 * ```typescript
 * escapeHtml('<script>alert("xss")</script>')
 * // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 * ```
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates the welcome message HTML
 *
 * Displayed when DashReader is opened but no text is loaded yet.
 * Instructs user how to start reading.
 *
 * @returns HTML string for welcome message
 */
export function createWelcomeMessage(): string {
  return `
    <div class="dashreader-welcome-message">
      <div class="dashreader-welcome-icon">${ICONS.book} Select text to start reading</div>
      <div class="dashreader-welcome-instruction">or use Cmd+P → "Read selected text"</div>
    </div>
  `;
}

/**
 * Creates the "ready to read" message HTML
 *
 * Displayed after text is loaded but before reading starts.
 * Shows word count, estimated duration, and instructions.
 *
 * @param wordsToRead - Number of words to read
 * @param totalWords - Total words in document
 * @param startIndex - Starting word index (if resuming)
 * @param durationText - Formatted estimated duration
 * @param sourceInfo - Optional source file information HTML
 * @returns HTML string for ready message
 */
export function createReadyMessage(
  wordsToRead: number,
  totalWords: number,
  startIndex: number | undefined,
  durationText: string,
  sourceInfo: string = ''
): string {
  const startInfo = startIndex !== undefined && startIndex > 0
    ? ` <span class="dashreader-ready-start-info">(starting at word ${startIndex + 1}/${totalWords})</span>`
    : '';

  return `
    <div class="dashreader-ready-message">
      ${sourceInfo}
      Ready to read ${wordsToRead} words${startInfo}<br/>
      <span class="dashreader-ready-duration">Estimated time: ~${durationText}</span><br/>
      <span class="dashreader-ready-duration">Press Shift+Space to start</span>
    </div>
  `;
}

// ============================================================================
// SECTION 6: LEGACY UTILITIES
// ============================================================================

/**
 * Toggles panel visibility helper
 *
 * @deprecated This function is legacy. Prefer using ViewState.toggle() and
 * DOMRegistry.toggleClass() directly in the view.
 *
 * Consolidates the three separate toggle functions (toggleControls,
 * toggleStats, toggleSettings) into one generic helper.
 *
 * @param panel - Panel element to toggle
 * @param registry - DOM registry for updates
 * @param registryKey - Key for the panel in registry
 * @param currentState - Current visibility state
 * @returns New visibility state
 */
export function togglePanel(
  panel: HTMLElement,
  registry: DOMRegistry,
  registryKey: string,
  currentState: boolean
): boolean {
  const newState = !currentState;
  panel.toggleClass(CSS_CLASSES.hidden, !newState);
  return newState;
}

/**
 * Creates a conditional group that can be shown/hidden
 *
 * @deprecated Use direct style.display manipulation instead. This function
 * adds unnecessary abstraction.
 *
 * Used for acceleration settings that appear when acceleration is enabled.
 *
 * @param parent - Parent element
 * @param config - Configuration with condition and groups
 * @returns Container element
 */
export function createConditionalGroup(
  parent: HTMLElement,
  config: ConditionalGroupConfig
): HTMLElement {
  const container = parent.createDiv({ cls: CSS_CLASSES.settingGroup });
  container.style.display = config.condition ? 'flex' : 'none';
  return container;
}

/**
 * Creates a setting group container
 *
 * Generic container for settings. This is primarily used internally by
 * other builder functions.
 *
 * @param parent - Parent element
 * @param className - Optional CSS class override
 * @returns Setting group container
 */
export function createSettingGroup(
  parent: HTMLElement,
  className?: string
): HTMLElement {
  return parent.createDiv({
    cls: className || CSS_CLASSES.settingGroup
  });
}
