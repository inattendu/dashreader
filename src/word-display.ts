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
      wordContainer.createSpan({
        text: iconPrefix,
        cls: 'dashreader-callout-icon'
      });
    }

    // Add processed word using DOM API (not innerHTML for security)
    this.addProcessedWord(wordContainer, word);
  }

  /**
   * Adds a processed word to the container using DOM API
   * This prevents XSS attacks by never using innerHTML with user content
   *
   * @param container - Container element to add word to
   * @param rawWord - Raw word (may contain special characters)
   */
  private addProcessedWord(container: HTMLElement, rawWord: string): void {
    // Special case: line breaks (don't highlight, just display)
    if (rawWord === '\n') {
      container.createEl('br');
      return;
    }

    // Remove heading and callout markers (already processed by engine)
    const word = rawWord.replace(/^\[H\d\]/, '').replace(/^\[CALLOUT:[\w-]+\]/, '');

    // Apply center character highlighting (always enabled)
    if (word.length > 0) {
      const centerIndex = Math.floor(word.length / 3);
      const before = word.substring(0, centerIndex);
      const center = word.charAt(centerIndex);
      const after = word.substring(centerIndex + 1);

      // Build using DOM API to prevent XSS
      if (before) {
        container.createSpan({ text: before });
      }
      container.createSpan({
        text: center,
        cls: 'dashreader-highlight'
      });
      if (after) {
        container.createSpan({ text: after });
      }
    } else {
      // Empty word, just add as text
      container.setText(word);
    }
  }

  /**
   * Displays a welcome message (no text loaded)
   * Uses DOM API to build the message instead of innerHTML
   *
   * @param icon - Icon to display
   * @param mainText - Main message text
   * @param subText - Instruction text
   */
  displayWelcomeMessage(icon: string, mainText: string, subText: string): void {
    this.wordEl.empty();
    const welcomeDiv = this.wordEl.createDiv({ cls: 'dashreader-welcome-message' });
    welcomeDiv.createDiv({
      text: `${icon} ${mainText}`,
      cls: 'dashreader-welcome-icon'
    });
    welcomeDiv.createDiv({
      text: subText,
      cls: 'dashreader-welcome-instruction'
    });
  }

  /**
   * Displays a ready message (text loaded, ready to start)
   * Uses DOM API to build the message instead of innerHTML
   *
   * @param wordsToRead - Number of words to read
   * @param totalWords - Total words in document
   * @param startIndex - Starting word index (if resuming)
   * @param durationText - Formatted estimated duration
   * @param fileName - Optional source file name
   * @param lineNumber - Optional source line number
   */
  displayReadyMessage(
    wordsToRead: number,
    totalWords: number,
    startIndex: number | undefined,
    durationText: string,
    fileName?: string,
    lineNumber?: number
  ): void {
    this.wordEl.empty();
    const readyDiv = this.wordEl.createDiv({ cls: 'dashreader-ready-message' });

    // Add source info if provided
    if (fileName) {
      const sourceDiv = readyDiv.createDiv({ cls: 'dashreader-ready-source' });
      sourceDiv.createSpan({ text: '📄 ' });
      sourceDiv.createSpan({ text: fileName });
      if (lineNumber) {
        sourceDiv.createSpan({ text: ` (line ${lineNumber})` });
      }
    }

    // Build main message
    const mainText = readyDiv.createSpan();
    mainText.createSpan({ text: `Ready to read ${wordsToRead} words` });

    if (startIndex !== undefined && startIndex > 0) {
      const startInfo = mainText.createSpan({ cls: 'dashreader-ready-start-info' });
      startInfo.setText(` (starting at word ${startIndex + 1}/${totalWords})`);
    }

    readyDiv.createEl('br');
    readyDiv.createSpan({
      text: `Estimated time: ~${durationText}`,
      cls: 'dashreader-ready-duration'
    });
    readyDiv.createEl('br');
    readyDiv.createSpan({
      text: 'Press Shift+Space to start',
      cls: 'dashreader-ready-duration'
    });
  }

  /**
   * Clears the word display
   */
  clear(): void {
    this.wordEl.empty();
  }
}
