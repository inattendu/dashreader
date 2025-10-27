/**
 * WordDisplay - Manages word display with highlighting and formatting
 *
 * Responsibilities:
 * - Display words with center character highlighting
 * - Handle heading display with dynamic font sizes
 * - Handle callout display with icons
 * - Show visual separators before headings
 * - Escape HTML to prevent XSS
 */

import { DashReaderSettings } from './types';
import { HEADING_MULTIPLIERS } from './constants';
import { escapeHtml } from './ui-builders';

export class WordDisplay {
  private wordEl: HTMLElement;
  private settings: DashReaderSettings;

  /**
   * Callout icon mapping
   */
  private readonly calloutIcons: Record<string, string> = {
    note: '📝',
    abstract: '📄',
    info: 'ℹ️',
    tip: '💡',
    success: '✅',
    question: '❓',
    warning: '⚠️',
    failure: '❌',
    danger: '⚡',
    bug: '🐛',
    example: '📋',
    quote: '💬'
  };

  constructor(wordEl: HTMLElement, settings: DashReaderSettings) {
    this.wordEl = wordEl;
    this.settings = settings;
  }

  /**
   * Updates settings (when user changes font size, etc.)
   *
   * @param settings - New settings to apply
   */
  updateSettings(settings: DashReaderSettings): void {
    this.settings = settings;
  }

  /**
   * Displays a word with optional heading level or callout type
   * Handles font size adjustment, icons, and separators
   *
   * @param word - The word to display
   * @param headingLevel - Heading level (1-6) or 0 for normal text/callouts
   * @param showSeparator - Whether to show separator line before heading/callout
   * @param calloutType - Callout type (note, abstract, info, etc.) if this is a callout
   */
  displayWord(word: string, headingLevel: number, showSeparator: boolean = false, calloutType?: string): void {
    // Calculate font size based on heading level or callout
    let fontSizeMultiplier = 1.0;
    let fontWeight = 'normal';
    let iconPrefix = '';

    if (calloutType) {
      // Callouts: slightly larger font, with icon prefix
      fontSizeMultiplier = 1.2;
      fontWeight = 'bold';
      iconPrefix = this.calloutIcons[calloutType.toLowerCase()] || '📌';
    } else if (headingLevel > 0) {
      // Headings: size based on level
      const multipliers = [
        0,
        HEADING_MULTIPLIERS.h1,
        HEADING_MULTIPLIERS.h2,
        HEADING_MULTIPLIERS.h3,
        HEADING_MULTIPLIERS.h4,
        HEADING_MULTIPLIERS.h5,
        HEADING_MULTIPLIERS.h6
      ];
      fontSizeMultiplier = multipliers[headingLevel] || 1.0;
      fontWeight = 'bold';
    }

    const adjustedFontSize = this.settings.fontSize * fontSizeMultiplier;
    const processedWord = this.processWord(word);

    // Clear and rebuild using DOM API (not innerHTML)
    this.wordEl.empty();

    // Add separator if needed
    if (showSeparator) {
      this.wordEl.createDiv({ cls: 'dashreader-heading-separator' });
    }

    // Create word container
    const wordContainer = this.wordEl.createDiv({ cls: 'dashreader-word-with-heading' });
    wordContainer.style.fontSize = `${adjustedFontSize}px`;
    wordContainer.style.fontWeight = fontWeight;

    // Add icon prefix if callout
    if (iconPrefix) {
      const iconSpan = wordContainer.createSpan({ text: iconPrefix });
      iconSpan.style.marginRight = '8px';
      iconSpan.style.opacity = '0.8';
    }

    // Add processed word (may contain HTML for highlighting)
    wordContainer.innerHTML = processedWord;
  }

  /**
   * Processes a word for display with center character highlighting
   * Escapes HTML to prevent XSS attacks
   *
   * @param rawWord - Raw word (may contain special characters)
   * @returns HTML string with highlighted center character
   */
  private processWord(rawWord: string): string {
    // Special case: line breaks (don't highlight, just display)
    if (rawWord === '\n') {
      return '<br/>';
    }

    // Remove heading and callout markers (already processed by engine)
    let word = rawWord.replace(/^\[H\d\]/, '').replace(/^\[CALLOUT:[\w-]+\]/, '');

    // Escape HTML to prevent XSS
    word = escapeHtml(word);

    // Apply center character highlighting (always enabled)
    if (word.length > 0) {
      const centerIndex = Math.floor(word.length / 3);
      const before = word.substring(0, centerIndex);
      const center = word.charAt(centerIndex);
      const after = word.substring(centerIndex + 1);

      return `${before}<span class="dashreader-highlight">${center}</span>${after}`;
    }

    return word;
  }

  /**
   * Displays a welcome message (no text loaded)
   *
   * @param message - HTML message to display
   */
  displayMessage(message: string): void {
    this.wordEl.innerHTML = message;
  }

  /**
   * Clears the word display
   */
  clear(): void {
    this.wordEl.empty();
  }
}
