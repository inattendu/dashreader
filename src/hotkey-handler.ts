/**
 * HotkeyHandler - Manages keyboard shortcuts for playback control
 *
 * Responsibilities:
 * - Handle Shift+Space for play/pause
 * - Handle configurable hotkeys (rewind, forward, WPM control, quit)
 * - Prevent default browser behavior when appropriate
 * - Call appropriate callbacks for each action
 */

import { DashReaderSettings } from './types';

export interface HotkeyCallbacks {
  onTogglePlay: () => void;
  onRewind: () => void;
  onForward: () => void;
  onIncrementWpm: () => void;
  onDecrementWpm: () => void;
  onQuit: () => void;
}

export class HotkeyHandler {
  private settings: DashReaderSettings;
  private callbacks: HotkeyCallbacks;

  constructor(settings: DashReaderSettings, callbacks: HotkeyCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
  }

  /**
   * Updates settings (when user changes hotkey preferences)
   *
   * @param settings - New settings to apply
   */
  updateSettings(settings: DashReaderSettings): void {
    this.settings = settings;
  }

  /**
   * Handles keyboard events
   * Called from keydown event listener in the view
   *
   * @param e - Keyboard event
   */
  handleKeyPress(e: KeyboardEvent): void {
    const keyCode = e.code || e.key;

    // Play/Pause with Shift+Space only
    if (keyCode === 'Space' && e.shiftKey) {
      e.preventDefault();
      this.callbacks.onTogglePlay();
      return;
    }

    // Other hotkeys (only when reading view is active, no input focused)
    if (this.isInputFocused()) {
      return;
    }

    // Rewind
    if (keyCode === this.settings.hotkeyRewind) {
      e.preventDefault();
      this.callbacks.onRewind();
      return;
    }

    // Forward
    if (keyCode === this.settings.hotkeyForward) {
      e.preventDefault();
      this.callbacks.onForward();
      return;
    }

    // Increment WPM
    if (keyCode === this.settings.hotkeyIncrementWpm) {
      e.preventDefault();
      this.callbacks.onIncrementWpm();
      return;
    }

    // Decrement WPM
    if (keyCode === this.settings.hotkeyDecrementWpm) {
      e.preventDefault();
      this.callbacks.onDecrementWpm();
      return;
    }

    // Quit
    if (keyCode === this.settings.hotkeyQuit) {
      e.preventDefault();
      this.callbacks.onQuit();
      return;
    }
  }

  /**
   * Checks if an input element is currently focused
   * Prevents hotkeys from interfering with typing
   *
   * @returns True if input/textarea is focused
   */
  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea';
  }
}
