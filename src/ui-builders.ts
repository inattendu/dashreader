/**
 * UI Builders - Reusable factory functions for building UI components
 *
 * Eliminates 150+ lines of duplicated control-building code across the view.
 */

import { CSS_CLASSES, ICONS } from './constants';
import { DOMRegistry } from './dom-registry';

export interface ButtonConfig {
  icon: string;
  title: string;
  onClick: () => void;
  className?: string;
}

export interface NumberControlConfig {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  increment?: number;
  registryKey?: string;
  decrementIcon?: string;
  incrementIcon?: string;
  decrementTitle?: string;
  incrementTitle?: string;
}

export interface ToggleControlConfig {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface ConditionalGroupConfig {
  condition: boolean;
  groups: HTMLElement[];
}

/**
 * Create a button element with consistent styling
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
 * Create a number control with increment/decrement buttons
 * This replaces the duplicated WPM/fontSize/chunkSize/acceleration controls
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
 * Create a toggle control (checkbox with label)
 * Replaces duplicated toggle code for showContext, micropause, acceleration, etc.
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

/**
 * Create a conditional group that can be shown/hidden
 * Used for acceleration settings that appear when acceleration is enabled
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
 * Toggle panel visibility helper
 * Consolidates the three separate toggle functions (toggleControls, toggleStats, toggleSettings)
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
 * Create a play/pause button pair
 * These buttons toggle visibility based on playing state
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
 * Update play/pause button visibility
 */
export function updatePlayPauseButtons(
  registry: DOMRegistry,
  isPlaying: boolean
): void {
  registry.toggleClass('playBtn', CSS_CLASSES.hidden, isPlaying);
  registry.toggleClass('pauseBtn', CSS_CLASSES.hidden, !isPlaying);
}

/**
 * Create a control group for settings
 * This is the generic version of the pattern used throughout buildInlineSettings
 */
export function createSettingGroup(
  parent: HTMLElement,
  className?: string
): HTMLElement {
  return parent.createDiv({
    cls: className || CSS_CLASSES.settingGroup
  });
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS
 * Centralized escaping function used throughout the view
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
 * Create welcome message HTML
 */
export function createWelcomeMessage(): string {
  return `
    <div style="font-size: 20px; color: var(--text-muted); text-align: center;">
      <div style="margin-bottom: 12px;">${ICONS.book} Select text to start reading</div>
      <div style="font-size: 14px; opacity: 0.7;">or use Cmd+P → "Read selected text"</div>
    </div>
  `;
}

/**
 * Create ready to read message HTML
 */
export function createReadyMessage(
  wordsToRead: number,
  totalWords: number,
  startIndex: number | undefined,
  durationText: string,
  sourceInfo: string = ''
): string {
  const startInfo = startIndex !== undefined && startIndex > 0
    ? ` <span style="opacity: 0.6;">(starting at word ${startIndex + 1}/${totalWords})</span>`
    : '';

  return `
    <div style="font-size: 18px; color: var(--text-muted); text-align: center;">
      ${sourceInfo}
      Ready to read ${wordsToRead} words${startInfo}<br/>
      <span style="font-size: 14px; opacity: 0.7;">Estimated time: ~${durationText}</span><br/>
      <span style="font-size: 14px; opacity: 0.7;">Press Shift+Space to start</span>
    </div>
  `;
}
