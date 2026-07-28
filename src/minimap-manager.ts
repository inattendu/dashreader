import { RSVPEngine } from './rsvp-engine';
import { HeadingInfo } from './types';
import { TimeoutManager } from './services/timeout-manager';
import { StatsFormatter } from './services/stats-formatter';
import { CSS_CLASSES } from './constants';

/**
 * Minimap orientation mode
 */
export type MinimapOrientation = 'vertical' | 'horizontal';

/**
 * MinimapManager
 *
 * Manages the minimap navigation that provides:
 * - Visual overview of document structure
 * - Quick navigation to any heading or position
 * - Current position indicator with subtle glow
 * - Ultra-discreet design (low opacity, increases on hover)
 *
 * Supports two orientations:
 * - vertical: Traditional sidebar minimap with points
 * - horizontal: Timeline-style bar with sections (click anywhere to navigate)
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
  private positionIndicatorEl: HTMLElement | null = null;
  private engine: RSVPEngine;
  private timeoutManager: TimeoutManager;
  private statsFormatter: StatsFormatter;
  private currentWordIndex: number = 0;
  private totalWords: number = 0;
  private orientation: MinimapOrientation;

  constructor(
    containerEl: HTMLElement,
    engine: RSVPEngine,
    timeoutManager: TimeoutManager,
    orientation: MinimapOrientation = 'vertical'
  ) {
    this.containerEl = containerEl;
    this.engine = engine;
    this.timeoutManager = timeoutManager;
    this.orientation = orientation;
    this.statsFormatter = new StatsFormatter();

    // Create minimap container with orientation class
    this.minimapEl = this.containerEl.createDiv({
      cls: `dashreader-minimap dashreader-minimap-${orientation}`
    });

    // Create progress indicator
    this.progressEl = this.minimapEl.createDiv({
      cls: 'dashreader-minimap-progress'
    });

    if (orientation === 'vertical') {
      // Create vertical line (purely visual)
      this.minimapEl.createDiv({
        cls: 'dashreader-minimap-line'
      });
    } else {
      // Create position indicator for horizontal mode
      this.positionIndicatorEl = this.minimapEl.createDiv({
        cls: 'dashreader-minimap-position'
      });

      // Add click handler for horizontal navigation
      this.minimapEl.addEventListener('click', (e) => this.handleTimelineClick(e));
      this.minimapEl.addEventListener('mousemove', (e) => this.handleTimelineHover(e));
      this.minimapEl.addEventListener('mouseleave', () => this.hideTooltip());
    }

    // Create tooltip
    this.tooltipEl = document.body.createDiv({
      cls: 'dashreader-minimap-tooltip'
    });
  }

  /**
   * Render the minimap with heading points/sections
   * Called when text is loaded or structure changes
   */
  render(): void {
    if (!this.minimapEl) return;

    // Clear existing points/sections
    const existingElements = this.minimapEl.querySelectorAll('.dashreader-minimap-point, .dashreader-minimap-section');
    existingElements.forEach(el => el.remove());

    const headings = this.engine.getHeadings();
    this.totalWords = this.engine.getTotalWords();

    if (this.totalWords === 0) {
      this.minimapEl.toggleClass(CSS_CLASSES.hidden, true);
      return;
    }

    this.minimapEl.toggleClass(CSS_CLASSES.hidden, false);

    if (this.orientation === 'horizontal') {
      this.renderHorizontal(headings);
    } else {
      this.renderVertical(headings);
    }

    // Update current position
    this.updateCurrentPosition(this.currentWordIndex);
  }

  /**
   * Render vertical minimap with points
   */
  private renderVertical(headings: HeadingInfo[]): void {
    if (headings.length === 0) return;

    headings.forEach((heading, index) => {
      this.createPoint(heading, index);
    });
  }

  /**
   * Render horizontal minimap with sections and heading labels
   */
  private renderHorizontal(headings: HeadingInfo[]): void {
    // Create sections based on headings
    // Each section spans from its heading to the next heading (or end)
    const sections: { start: number; end: number; heading: HeadingInfo | null }[] = [];

    if (headings.length === 0) {
      // No headings: single section for entire document
      sections.push({ start: 0, end: this.totalWords, heading: null });
    } else {
      // Add section before first heading if it doesn't start at 0
      if (headings[0].wordIndex > 0) {
        sections.push({ start: 0, end: headings[0].wordIndex, heading: null });
      }

      // Add sections for each heading
      for (let i = 0; i < headings.length; i++) {
        const start = headings[i].wordIndex;
        const end = i < headings.length - 1 ? headings[i + 1].wordIndex : this.totalWords;
        sections.push({ start, end, heading: headings[i] });
      }
    }

    // Render sections as proportional bars with labels
    sections.forEach((section) => {
      const sectionEl = this.minimapEl.createDiv({
        cls: 'dashreader-minimap-section'
      });

      // Width proportional to section length
      const widthPercent = ((section.end - section.start) / this.totalWords) * 100;
      sectionEl.style.width = `${widthPercent}%`;

      // Store data for navigation
      sectionEl.setAttribute('data-start', section.start.toString());
      sectionEl.setAttribute('data-end', section.end.toString());

      if (section.heading) {
        sectionEl.setAttribute('data-level', section.heading.level.toString());
        sectionEl.setAttribute('data-heading-text', section.heading.text);
        sectionEl.classList.add('dashreader-minimap-section-heading');

        // Add heading label inside section
        const labelEl = sectionEl.createDiv({
          cls: 'dashreader-minimap-section-label',
          text: section.heading.text
        });
        labelEl.setAttribute('data-level', section.heading.level.toString());
      }
    });
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
   * Update which point/section is highlighted as current
   */
  updateCurrentPosition(wordIndex: number): void {
    this.currentWordIndex = wordIndex;

    if (!this.minimapEl) return;

    const progressPercentage = this.totalWords > 0
      ? (wordIndex / this.totalWords) * 100
      : 0;

    if (this.orientation === 'horizontal') {
      // Horizontal mode: update position indicator and progress
      if (this.progressEl) {
        this.progressEl.style.width = `${Math.min(100, Math.max(0, progressPercentage))}%`;
      }
      if (this.positionIndicatorEl) {
        this.positionIndicatorEl.style.left = `${Math.min(100, Math.max(0, progressPercentage))}%`;
      }

      // Update current section highlight
      const sections = this.minimapEl.querySelectorAll('.dashreader-minimap-section');
      sections.forEach((section) => {
        const start = parseInt(section.getAttribute('data-start') || '0');
        const end = parseInt(section.getAttribute('data-end') || '0');

        if (wordIndex >= start && wordIndex < end) {
          section.classList.add('dashreader-minimap-section-current');
        } else {
          section.classList.remove('dashreader-minimap-section-current');
        }
      });
    } else {
      // Vertical mode: update progress and current point
      if (this.progressEl) {
        this.progressEl.style.height = `${Math.min(100, Math.max(0, progressPercentage))}%`;
      }

      // Find the current heading
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
  }

  /**
   * Handle click on horizontal timeline
   */
  private handleTimelineClick(e: MouseEvent): void {
    if (this.totalWords === 0) return;

    const rect = this.minimapEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    const targetIndex = Math.floor(ratio * this.totalWords);

    this.navigateToHeading(Math.max(0, Math.min(targetIndex, this.totalWords - 1)));
  }

  /**
   * Handle hover on horizontal timeline (show tooltip with time/heading)
   */
  private handleTimelineHover(e: MouseEvent): void {
    if (this.totalWords === 0) return;

    const rect = this.minimapEl.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = hoverX / rect.width;
    const hoverIndex = Math.floor(ratio * this.totalWords);

    // Get time at this position
    const timeAtIndex = this.engine.getVirtualElapsedSecondsAtIndex(hoverIndex);
    const totalTime = this.engine.getVirtualTotalSeconds();
    const timeText = `${this.statsFormatter.formatTime(timeAtIndex)} / ${this.statsFormatter.formatTime(totalTime)}`;

    // Find heading at this position
    const headings = this.engine.getHeadings();
    const relevantHeadings = headings.filter(h => h.wordIndex <= hoverIndex);
    const heading = relevantHeadings.length > 0
      ? relevantHeadings[relevantHeadings.length - 1]
      : null;

    // Build tooltip text
    let tooltipText = timeText;
    if (heading) {
      const cleanHeading = heading.text
        .replace(/^\[H\d\]/, '')
        .replace(/^\[CALLOUT:[\w-]+\]/, '')
        .trim();
      tooltipText = `${cleanHeading} • ${timeText}`;
    }

    // Show tooltip
    this.tooltipEl.textContent = tooltipText;
    this.tooltipEl.style.left = `${e.clientX}px`;
    this.tooltipEl.style.top = `${rect.top - 40}px`;
    this.tooltipEl.classList.add('visible');
  }

  /**
   * Navigate to a specific word index
   */
  private navigateToHeading(wordIndex: number): void {
    const wasPlaying = this.engine.getIsPlaying();

    // Use the engine's direct navigation
    this.engine.goToIndex(wordIndex);

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
      this.minimapEl.toggleClass(CSS_CLASSES.hidden, false);
    }
  }

  /**
   * Hide the minimap
   */
  hide(): void {
    if (this.minimapEl) {
      this.minimapEl.toggleClass(CSS_CLASSES.hidden, true);
    }
  }

  /**
   * Setup wheel navigation on the minimap
   * @param onForward - Callback when scrolling forward (down)
   * @param onBackward - Callback when scrolling backward (up)
   */
  setupWheelNavigation(onForward: () => void, onBackward: () => void): void {
    let wheelAccum = 0;
    let wheelDir = 0;
    const WHEEL_THRESHOLD = 80;

    this.minimapEl.addEventListener('wheel', (e: WheelEvent) => {
      // Skip if modifier keys pressed (allow zoom, etc.)
      if (e.ctrlKey || e.metaKey) return;

      e.preventDefault();

      // Normalize deltaY based on deltaMode
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        // Line mode (Firefox)
        dy *= 16;
      } else if (e.deltaMode === 2) {
        // Page mode
        dy *= 800;
      }

      // Reset accumulator on direction change
      const dir = Math.sign(dy);
      if (dir !== 0 && dir !== wheelDir) {
        wheelAccum = 0;
        wheelDir = dir;
      }

      wheelAccum += dy;

      // Forward (scroll down)
      if (wheelAccum >= WHEEL_THRESHOLD) {
        wheelAccum -= WHEEL_THRESHOLD;
        wheelAccum = Math.min(wheelAccum, WHEEL_THRESHOLD - 1);
        onForward();
      }
      // Backward (scroll up)
      else if (wheelAccum <= -WHEEL_THRESHOLD) {
        wheelAccum += WHEEL_THRESHOLD;
        wheelAccum = Math.max(wheelAccum, -(WHEEL_THRESHOLD - 1));
        onBackward();
      }
    }, { passive: false });
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
