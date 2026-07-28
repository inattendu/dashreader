/**
 * WordDisplay - Manages word display with highlighting and formatting
 *
 * Responsibilities:
 * - Display words with ORP (Optimal Recognition Point) highlighting
 * - Keep ORP at a fixed screen position (aligned with focus bars)
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

  // Permanent DOM structure for ORP anchoring
  private overlayEl: HTMLElement;
  private contentEl: HTMLElement;
  private focusDashesEl: HTMLElement;

  // Base values for font size calculations
  private baseFontSizePx: number;
  private baseChunkSize: number;

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

  constructor(wordEl: HTMLElement, settings: DashReaderSettings, displayArea?: HTMLElement) {
    this.wordEl = wordEl;
    this.settings = settings;
    this.baseFontSizePx = settings.fontSize;
    this.baseChunkSize = settings.chunkSize || 1;

    // Build permanent overlay + content structure for ORP anchoring
    this.wordEl.empty();
    this.wordEl.style.position = 'relative';
    this.wordEl.setAttribute('data-running', 'false');

    // Focus overlay with lines and dashes
    this.overlayEl = this.wordEl.createDiv({ cls: 'dashreader-focus-overlay' });
    this.overlayEl.createDiv({ cls: 'dashreader-focus-lines' });
    this.focusDashesEl = this.overlayEl.createDiv({ cls: 'dashreader-focus-dashes' });

    // Content container (above overlay)
    this.contentEl = this.wordEl.createDiv({ cls: 'dashreader-word-content' });

    // Default focus position: near center
    this.wordEl.style.setProperty('--dashreader-focus-left', '48%');
  }

  /**
   * Sets the display area reference (kept for API compatibility)
   */
  setDisplayArea(displayArea: HTMLElement): void {
    // No longer needed with new architecture, kept for compatibility
  }

  /**
   * Sets base font size for calculations
   */
  setBaseFontSize(px: number): void {
    this.baseFontSizePx = px;
  }

  /**
   * Sets chunk size for focus position calculations
   */
  setChunkSize(n: number): void {
    this.baseChunkSize = Math.max(1, n);
  }

  /**
   * Updates settings (when user changes font size, etc.)
   */
  updateSettings(settings: DashReaderSettings): void {
    this.settings = settings;
    this.baseFontSizePx = settings.fontSize;
    this.baseChunkSize = settings.chunkSize || 1;
  }

  /**
   * Displays a word with optional heading level or callout type
   * Handles font size adjustment, icons, separators, and ORP anchoring
   */
  displayWord(word: string, headingLevel: number, showSeparator: boolean = false, calloutType?: string): void {
    // Calculate font size based on heading level or callout
    let fontSizeMultiplier = 1.0;
    let fontWeight = 'normal';
    let iconPrefix = '';

    if (calloutType) {
      fontSizeMultiplier = 1.2;
      fontWeight = 'bold';
      iconPrefix = this.calloutIcons[calloutType.toLowerCase()] || '📌';
    } else if (headingLevel > 0) {
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

    const adjustedFontSize = this.baseFontSizePx * fontSizeMultiplier;
    const cleaned = this.stripMarkers(word).trim();
    const displayText = cleaned.length ? cleaned : word.trim();

    // Calculate focus position based on chunk size
    const chunkSize = Math.max(1, this.baseChunkSize);
    const center = 48;
    const left = 15;
    const maxChunkForFullShift = 5;
    const t = Math.min(1, Math.max(0, (chunkSize - 1) / (maxChunkForFullShift - 1)));
    const focus = center - t * (center - left);

    this.wordEl.style.setProperty('--dashreader-focus-left', `${focus}%`);
    this.wordEl.setAttribute('data-running', 'true');

    // Clear old messages
    this.wordEl
      .querySelectorAll('.dashreader-welcome-message, .dashreader-ready-message')
      .forEach(el => el.remove());

    // Clear and rebuild content
    this.contentEl.empty();

    // Create word container
    const wordContainer = this.contentEl.createDiv({ cls: 'dashreader-word-with-heading' });
    wordContainer.style.fontSize = `${adjustedFontSize}px`;
    wordContainer.style.fontWeight = fontWeight;

    // Add icon prefix if callout
    if (iconPrefix) {
      wordContainer.createSpan({
        text: iconPrefix,
        cls: 'dashreader-callout-icon'
      });
    }

    // Create ORP viewport and line for anchoring
    const viewport = wordContainer.createDiv({ cls: 'dashreader-orp-viewport' });
    const line = viewport.createDiv({ cls: 'dashreader-orp-line' });

    // Build word spans with ORP highlighting
    const orpEl = this.buildWordSpans(line, displayText);
    const focusWordEl = line.querySelector('.dashreader-focus-word') as HTMLElement | null;

    // Shrinking disabled - causes more problems than it solves
    // Text displays at configured size, overflow handled by CSS
    const shouldShrink = false;

    // Defer ORP anchoring until layout is available
    requestAnimationFrame(() => {
      wordContainer.style.fontSize = `${adjustedFontSize}px`;

      if (viewport.clientWidth === 0) {
        // Retry if viewport not ready
        requestAnimationFrame(() => {
          wordContainer.style.fontSize = `${adjustedFontSize}px`;

          // Shrink if needed, then anchor
          if (shouldShrink) {
            const minSize = Math.max(8, this.settings.minTokenFontSize || 12);
            this.shrinkFocusWordToFit(viewport, line, focusWordEl, orpEl, adjustedFontSize, minSize);
          }
          this.applyOrpAnchoring(viewport, line, orpEl);
        });
        return;
      }

      // Shrink word if it doesn't fit, then anchor ORP
      if (shouldShrink) {
        const minSize = Math.max(8, this.settings.minTokenFontSize || 12);
        this.shrinkFocusWordToFit(viewport, line, focusWordEl, orpEl, adjustedFontSize, minSize);
      }
      this.applyOrpAnchoring(viewport, line, orpEl);
    });
  }

  /**
   * Strip heading and callout markers from word
   */
  private stripMarkers(rawWord: string): string {
    return rawWord.replace(/^\[H\d\]/, '').replace(/^\[CALLOUT:[\w-]+\]/, '');
  }

  /**
   * Calculates the Optimal Recognition Point (ORP) index for a word
   * Based on the Squirt speed reading algorithm
   */
  private getORPIndex(word: string): number {
    const str = word.endsWith('\n') ? word.slice(0, -1) : word;
    const len = str.length;
    if (len <= 0) return 0;

    let point = 4;
    if (len < 2) point = 0;
    else if (len < 6) point = 1;
    else if (len < 10) point = 2;
    else if (len < 14) point = 3;

    const isLetterOrDigit = (ch: string | undefined) =>
      !!ch && (/\d/.test(ch) || ch.toLowerCase() !== ch.toUpperCase());

    if (!isLetterOrDigit(str[point])) {
      if (isLetterOrDigit(str[point - 1])) point--;
      else if (isLetterOrDigit(str[point + 1])) point++;
    }

    if (point < 0) point = 0;
    if (point >= str.length) point = str.length - 1;
    return point;
  }

  /**
   * Builds spans for the word with ORP highlighting
   * Returns the ORP span element
   */
  private buildWordSpans(lineEl: HTMLElement, displayWord: string): HTMLElement | null {
    lineEl.empty();
    if (!displayWord || displayWord === '\n') return null;

    const focusWordEl = lineEl.createSpan({ cls: 'dashreader-focus-word' });

    const orpIndex = this.getORPIndex(displayWord);
    for (let i = 0; i < displayWord.length; i++) {
      const ch = displayWord.charAt(i);
      const span = focusWordEl.createSpan({ text: ch });
      if (i === orpIndex) {
        span.addClass('dashreader-highlight');
        span.addClass('dashreader-orp');
      }
    }

    return focusWordEl.querySelector('.dashreader-orp') as HTMLElement | null;
  }

  /**
   * Applies ORP anchoring by shifting the line so ORP aligns with the focus dashes.
   * Uses viewport-local coordinates like the fork does.
   */
  private applyOrpAnchoring(viewportEl: HTMLElement, lineEl: HTMLElement, orpEl: HTMLElement | null): void {
    if (!orpEl) {
      lineEl.style.transform = 'translateX(0px)';
      return;
    }

    // Reset transform for measurement
    lineEl.style.transform = 'translateX(0px)';

    // Get viewport rect as reference for local coordinates
    const viewportRect = viewportEl.getBoundingClientRect();

    // Validate viewport has valid dimensions
    if (viewportRect.width === 0) {
      lineEl.style.transform = 'translateX(0px)';
      return;
    }

    // Get focus dashes center in viewport-local coordinates
    const focusRect = this.focusDashesEl.getBoundingClientRect();

    // Validate focus dashes have valid dimensions
    // If focusDashesEl has no width, fall back to centering in viewport
    if (focusRect.width === 0) {
      // Fallback: center the ORP character in the viewport
      const orpCenterInLine = orpEl.offsetLeft + orpEl.offsetWidth / 2;
      const lineLeft = lineEl.offsetLeft;
      const viewportCenter = viewportRect.width / 2;
      const delta = viewportCenter - (lineLeft + orpCenterInLine);

      // Clamp delta to prevent text from going off-screen
      const maxDelta = viewportRect.width / 2;
      const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));

      lineEl.style.transform = `translateX(${Math.round(clampedDelta)}px)`;
      return;
    }

    const focusX = (focusRect.left + focusRect.width / 2) - viewportRect.left;

    // Get ORP center using offset properties (relative to parent)
    const lineLeft = lineEl.offsetLeft;
    const orpCenterInLine = orpEl.offsetLeft + orpEl.offsetWidth / 2;

    // Calculate delta to align ORP with focus dashes
    const delta = focusX - (lineLeft + orpCenterInLine);

    // Clamp delta to prevent text from going completely off-screen
    const maxDelta = viewportRect.width;
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));

    lineEl.style.transform = `translateX(${Math.round(clampedDelta)}px)`;
  }

  /**
   * Binary-search shrink for a single token if it overflows the viewport
   */
  private shrinkFocusWordToFit(
    viewportEl: HTMLElement,
    lineEl: HTMLElement,
    focusWordEl: HTMLElement | null,
    orpEl: HTMLElement | null,
    startSize: number,
    minSize: number
  ): number {
    if (!focusWordEl || !orpEl) return startSize;

    const prevTransition = focusWordEl.style.transition;
    focusWordEl.style.transition = 'none';

    const fitsFocusWord = (): boolean => {
      const vw = viewportEl.clientWidth;
      if (vw <= 0) return true;

      const viewportRect = viewportEl.getBoundingClientRect();
      const fRect = this.focusDashesEl.getBoundingClientRect();
      const focusX = (fRect.left + fRect.width / 2) - viewportRect.left;

      // Validate focusX is reasonable (within viewport bounds with some margin)
      if (focusX < 0 || focusX > vw) return true;

      const orpCenter = orpEl.offsetLeft + orpEl.offsetWidth / 2;
      const wordLeft = focusWordEl.offsetLeft;
      const wordRight = wordLeft + focusWordEl.offsetWidth;

      const leftDist = orpCenter - wordLeft;
      const rightDist = wordRight - orpCenter;

      const leftEdge = focusX - leftDist;
      const rightEdge = focusX + rightDist;

      return leftEdge >= 0 && rightEdge <= vw;
    };

    // Reset to requested size
    focusWordEl.style.fontSize = `${startSize}px`;
    lineEl.getBoundingClientRect(); // Force reflow

    if (fitsFocusWord()) {
      focusWordEl.style.transition = prevTransition;
      return startSize;
    }

    // Binary search for optimal size
    let lo = Math.max(8, minSize);
    let hi = startSize;
    let best = lo;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      focusWordEl.style.fontSize = `${mid}px`;
      lineEl.getBoundingClientRect(); // Force reflow

      if (fitsFocusWord()) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    focusWordEl.style.fontSize = `${best}px`;
    lineEl.getBoundingClientRect();
    focusWordEl.style.transition = prevTransition;

    return best;
  }

  /**
   * Displays a welcome message (no text loaded)
   */
  displayWelcomeMessage(icon: string, mainText: string, subText: string): void {
    this.contentEl.empty();
    this.wordEl.setAttribute('data-running', 'false');
    const welcomeDiv = this.contentEl.createDiv({ cls: 'dashreader-welcome-message' });
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
   */
  displayReadyMessage(
    wordsToRead: number,
    totalWords: number,
    startIndex: number | undefined,
    durationText: string,
    fileName?: string,
    lineNumber?: number
  ): void {
    this.contentEl.empty();
    this.wordEl.setAttribute('data-running', 'false');
    const readyDiv = this.contentEl.createDiv({ cls: 'dashreader-ready-message' });

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
    this.contentEl.empty();
    this.wordEl.setAttribute('data-running', 'false');
  }
}
