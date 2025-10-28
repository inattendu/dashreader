import { RSVPEngine } from './rsvp-engine';
import { HeadingInfo } from './types';
import { TimeoutManager } from './services/timeout-manager';

/**
 * MinimapManager
 *
 * Manages the vertical minimap navigation that provides:
 * - Visual overview of document structure
 * - Quick navigation to any heading
 * - Current position indicator with subtle glow
 * - Ultra-discreet design (low opacity, increases on hover)
 *
 * Design Philosophy:
 * - Distraction-free: opacity 0.15 by default
 * - Visual hierarchy: H1=large, H2=medium, H3=small points
 * - Always visible but nearly invisible
 * - Instant navigation on click
 */
export class MinimapManager {
  private containerEl: HTMLElement;
  private minimapEl: HTMLElement;
  private progressEl: HTMLElement;
  private tooltipEl: HTMLElement;
  private engine: RSVPEngine;
  private timeoutManager: TimeoutManager;
  private currentWordIndex: number = 0;
  private totalWords: number = 0;

  constructor(containerEl: HTMLElement, engine: RSVPEngine, timeoutManager: TimeoutManager) {
    this.containerEl = containerEl;
    this.engine = engine;
    this.timeoutManager = timeoutManager;

    // Initialize minimap structure immediately (no null as any!)
    // Create minimap container
    this.minimapEl = this.containerEl.createDiv({
      cls: 'dashreader-minimap'
    });

    // Create progress indicator (fills from top)
    this.progressEl = this.minimapEl.createDiv({
      cls: 'dashreader-minimap-progress'
    });

    // Create vertical line (purely visual, no need to store reference)
    this.minimapEl.createDiv({
      cls: 'dashreader-minimap-line'
    });

    // Create tooltip (slides from right on hover)
    this.tooltipEl = document.body.createDiv({
      cls: 'dashreader-minimap-tooltip'
    });
  }

  /**
   * Render the minimap with heading points
   * Called when text is loaded or structure changes
   */
  render(): void {
    if (!this.minimapEl) return;

    // Clear existing points (keep the line)
    const existingPoints = this.minimapEl.querySelectorAll('.dashreader-minimap-point');
    existingPoints.forEach(point => point.remove());

    const headings = this.engine.getHeadings();
    this.totalWords = this.engine.getTotalWords();

    if (headings.length === 0 || this.totalWords === 0) {
      this.minimapEl.style.display = 'none';
      return;
    }

    this.minimapEl.style.display = 'block';

    // Create points for each heading
    headings.forEach((heading, index) => {
      this.createPoint(heading, index);
    });

    // Update current position
    this.updateCurrentPosition(this.currentWordIndex);
  }

  /**
   * Create a point for a heading
   */
  private createPoint(heading: HeadingInfo, index: number): void {
    const point = this.minimapEl.createDiv({
      cls: 'dashreader-minimap-point'
    });

    // Position proportionally based on word index
    const percentage = (heading.wordIndex / this.totalWords) * 100;
    point.style.top = `${percentage}%`;

    // Size based on heading level (H1 largest, H6 smallest)
    point.setAttribute('data-level', heading.level.toString());
    point.setAttribute('data-index', index.toString());
    point.setAttribute('data-word-index', heading.wordIndex.toString());

    // Store heading text for tooltip
    point.setAttribute('data-heading-text', heading.text);

    // Click handler - navigate to heading
    point.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToHeading(heading.wordIndex);
    });

    // Hover handlers - show tooltip sliding from right
    point.addEventListener('mouseenter', () => {
      this.showTooltip(heading.text, point);
    });

    point.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * Update which point is highlighted as current
   */
  updateCurrentPosition(wordIndex: number): void {
    this.currentWordIndex = wordIndex;

    if (!this.minimapEl) return;

    // Update progress indicator
    if (this.progressEl && this.totalWords > 0) {
      const progressPercentage = (wordIndex / this.totalWords) * 100;
      this.progressEl.style.height = `${Math.min(100, Math.max(0, progressPercentage))}%`;
    }

    // Find the current heading (last heading before or at current position)
    const headings = this.engine.getHeadings();
    if (headings.length === 0) return;

    const relevantHeadings = headings.filter(h => h.wordIndex <= wordIndex);
    const currentHeading = relevantHeadings.length > 0
      ? relevantHeadings[relevantHeadings.length - 1]
      : null;

    // Update all points
    const points = this.minimapEl.querySelectorAll('.dashreader-minimap-point');
    points.forEach((point) => {
      const pointWordIndex = parseInt(point.getAttribute('data-word-index') || '0');

      if (currentHeading && pointWordIndex === currentHeading.wordIndex) {
        point.classList.add('dashreader-minimap-point-current');
      } else {
        point.classList.remove('dashreader-minimap-point-current');
      }
    });
  }

  /**
   * Navigate to a specific heading
   */
  private navigateToHeading(wordIndex: number): void {
    const wasPlaying = this.engine.getIsPlaying();

    if (wasPlaying) {
      this.engine.pause();
    }

    // Use the engine's jump functionality (via rewind/forward)
    const currentIndex = this.engine.getCurrentIndex();
    const delta = wordIndex - currentIndex;

    if (delta < 0) {
      this.engine.rewind(Math.abs(delta));
    } else if (delta > 0) {
      this.engine.forward(delta);
    }

    // Resume reading after a short delay (gives user time to see the jump)
    if (wasPlaying) {
      this.timeoutManager.setTimeout(() => {
        this.engine.play();
      }, 300);
    }
  }

  /**
   * Show tooltip with heading text (slides from right)
   */
  private showTooltip(text: string, pointEl: HTMLElement): void {
    if (!this.tooltipEl) return;

    // Remove heading markers and callout markers
    const cleanText = text
      .replace(/^\[H\d\]/, '')
      .replace(/^\[CALLOUT:[\w-]+\]/, '')
      .trim();

    this.tooltipEl.textContent = cleanText;

    // Position tooltip vertically aligned with point
    const pointRect = pointEl.getBoundingClientRect();
    const tooltipHeight = 32; // Approximate height
    this.tooltipEl.style.top = `${pointRect.top + (pointRect.height / 2) - (tooltipHeight / 2)}px`;

    // Add visible class to trigger slide animation
    this.tooltipEl.classList.add('visible');
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.classList.remove('visible');
  }

  /**
   * Show the minimap
   */
  show(): void {
    if (this.minimapEl) {
      this.minimapEl.style.display = 'block';
    }
  }

  /**
   * Hide the minimap
   */
  hide(): void {
    if (this.minimapEl) {
      this.minimapEl.style.display = 'none';
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.minimapEl) {
      this.minimapEl.remove();
    }
    if (this.tooltipEl) {
      this.tooltipEl.remove();
    }
  }
}
