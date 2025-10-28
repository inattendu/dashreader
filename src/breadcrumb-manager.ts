/**
 * BreadcrumbManager - Manages breadcrumb navigation and heading menus
 *
 * Responsibilities:
 * - Display hierarchical breadcrumb (H1 > H2 > H3)
 * - Show outline button (≡) for full document structure
 * - Show dropdown (▼) for sibling navigation
 * - Navigate to headings with play/pause handling
 */

import { HeadingContext } from './types';
import { MenuBuilder } from './menu-builder';
import { RSVPEngine } from './rsvp-engine';

export class BreadcrumbManager {
  private breadcrumbEl: HTMLElement;
  private engine: RSVPEngine;
  private lastHeadingContext: HeadingContext | null = null;

  /**
   * Callout icon mapping (consistent with WordDisplay)
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

  constructor(breadcrumbEl: HTMLElement, engine: RSVPEngine) {
    this.breadcrumbEl = breadcrumbEl;
    this.engine = engine;
  }

  /**
   * Updates the breadcrumb navigation bar with current heading context
   * Shows hierarchical path (H1 > H2 > H3) and makes it clickable for navigation
   *
   * @param context - Current heading context from engine
   */
  updateBreadcrumb(context: HeadingContext): void {
    if (!context || context.breadcrumb.length === 0) {
      // No headings, hide breadcrumb
      this.breadcrumbEl.style.display = 'none';
      return;
    }

    // Show breadcrumb (display: flex already in CSS)
    this.breadcrumbEl.style.display = 'flex';
    this.breadcrumbEl.empty();

    // === SIMPLIFIED BREADCRUMB: 📑 H1 › H2 › H3 ▼ ===

    // Document icon
    this.breadcrumbEl.createSpan({
      text: '📑',
      cls: 'dashreader-breadcrumb-icon'
    });

    // Build breadcrumb path
    context.breadcrumb.forEach((heading, index) => {
      // Add separator between items
      if (index > 0) {
        this.breadcrumbEl.createSpan({
          text: '›',
          cls: 'dashreader-breadcrumb-separator'
        });
      }

      // Create breadcrumb item (clickable text)
      const itemSpan = this.breadcrumbEl.createSpan({
        cls: 'dashreader-breadcrumb-item'
      });

      // Callout icon if applicable
      const calloutMatch = heading.text.match(/^\[CALLOUT:([\w-]+)\]/);
      let displayText = heading.text;
      let icon = '';

      if (calloutMatch) {
        const calloutType = calloutMatch[1];
        icon = this.calloutIcons[calloutType.toLowerCase()] || '📌';
        displayText = heading.text.replace(/^\[CALLOUT:[\w-]+\]/, '').trim();
      }

      // Build text with optional icon
      itemSpan.textContent = icon ? `${icon} ${displayText}` : displayText;

      // Click on item -> navigate to heading
      itemSpan.addEventListener('click', () => {
        this.navigateToHeading(heading.wordIndex);
      });
    });

    // Single dropdown at the end - opens full outline
    const dropdown = this.breadcrumbEl.createSpan({
      text: '▼',
      cls: 'dashreader-breadcrumb-dropdown'
    });

    dropdown.addEventListener('click', () => {
      this.showOutlineMenu(dropdown);
    });

    this.lastHeadingContext = context;
  }

  /**
   * Closes all open menus (outline menus)
   * Called before opening a new menu to ensure only one menu is visible
   */
  private closeAllMenus(): void {
    // Remove all outline menus
    document.querySelectorAll('.dashreader-outline-menu').forEach(menu => {
      menu.remove();
    });
  }

  /**
   * Checks if heading context has changed (to avoid unnecessary updates)
   *
   * @param newContext - New heading context to check
   * @returns True if context has changed, false otherwise
   */
  hasHeadingContextChanged(newContext: HeadingContext): boolean {
    if (!this.lastHeadingContext) return true;

    if (this.lastHeadingContext.breadcrumb.length !== newContext.breadcrumb.length) {
      return true;
    }

    for (let i = 0; i < newContext.breadcrumb.length; i++) {
      if (this.lastHeadingContext.breadcrumb[i].wordIndex !== newContext.breadcrumb[i].wordIndex) {
        return true;
      }
    }

    return false; // No change
  }

  /**
   * Shows outline menu with all headings in the document
   * Displays complete document structure with indentation by level
   * Highlights current position in the list
   *
   * @param anchorEl - The element to position the menu relative to
   */
  private showOutlineMenu(anchorEl: HTMLElement): void {
    // Close any existing menus first
    this.closeAllMenus();

    const allHeadings = this.engine.getHeadings();

    if (allHeadings.length === 0) {
      return; // No headings to display
    }

    // Get current position to highlight active heading
    const currentIndex = this.engine.getCurrentIndex();
    const relevantHeadings = allHeadings.filter(h => h.wordIndex <= currentIndex);
    const currentHeading = relevantHeadings.length > 0
      ? relevantHeadings[relevantHeadings.length - 1]
      : null;

    // Create menu using MenuBuilder
    const menu = MenuBuilder.createMenu({
      anchorEl: anchorEl,
      cssClass: 'dashreader-outline-menu',
      title: 'Document Outline',
      items: allHeadings.map(h => ({
        text: h.text,
        wordIndex: h.wordIndex,
        level: h.level,
        isCurrent: currentHeading ? h.wordIndex === currentHeading.wordIndex : false
      })),
      onItemClick: (wordIndex) => this.navigateToHeading(wordIndex),
      showLevel: true,
      indentByLevel: true
    });

    // Scroll to current item if present
    if (currentHeading) {
      MenuBuilder.scrollToCurrentItem(menu);
    }
  }

  /**
   * Navigates to a specific heading by word index
   * Pauses playback, jumps to the heading position, and resumes if it was playing
   *
   * @param wordIndex - Word index to navigate to
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

    if (wasPlaying) {
      this.engine.play();
    }
  }

  /**
   * Resets the breadcrumb state (for new text loading)
   */
  reset(): void {
    this.lastHeadingContext = null;
  }
}
