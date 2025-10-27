/**
 * BreadcrumbManager - Manages breadcrumb navigation and heading menus
 *
 * Responsibilities:
 * - Display hierarchical breadcrumb (H1 > H2 > H3)
 * - Show outline button (≡) for full document structure
 * - Show dropdown (▼) for sibling navigation
 * - Navigate to headings with play/pause handling
 */

import { HeadingContext, HeadingInfo } from './types';
import { MenuBuilder } from './menu-builder';
import { RSVPEngine } from './rsvp-engine';
import { ICONS } from './constants';

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

    // Show breadcrumb
    this.breadcrumbEl.style.display = 'flex';
    this.breadcrumbEl.style.flexDirection = 'column';
    this.breadcrumbEl.style.gap = '8px';
    this.breadcrumbEl.empty();

    // === BREADCRUMB HEADER (Outline button) ===
    const breadcrumbHeader = this.breadcrumbEl.createDiv({
      cls: 'dashreader-breadcrumb-header'
    });

    // Outline button - opens full document structure
    const outlineButton = breadcrumbHeader.createSpan({
      text: '≡',
      cls: 'dashreader-outline-button'
    });

    outlineButton.addEventListener('click', () => {
      this.showOutlineMenu(outlineButton);
    });

    // === BREADCRUMB PATH CONTAINER ===
    const breadcrumbPath = this.breadcrumbEl.createDiv({
      cls: 'dashreader-breadcrumb-path'
    });

    // Build breadcrumb items
    context.breadcrumb.forEach((heading, index) => {
      // Add separator between items
      if (index > 0) {
        breadcrumbPath.createSpan({
          text: '›',
          cls: 'dashreader-breadcrumb-separator'
        });
      }

      // Create breadcrumb item container
      const itemContainer = breadcrumbPath.createSpan({
        cls: 'dashreader-breadcrumb-item'
      });
      itemContainer.style.cursor = 'pointer';

      // Callout icon if applicable
      const calloutMatch = heading.text.match(/^\[CALLOUT:([\w-]+)\]/);
      let displayText = heading.text;
      let icon = '';

      if (calloutMatch) {
        const calloutType = calloutMatch[1];
        icon = this.calloutIcons[calloutType.toLowerCase()] || '📌';
        displayText = heading.text.replace(/^\[CALLOUT:[\w-]+\]/, '').trim();
      }

      // Add icon if present
      if (icon) {
        const iconSpan = itemContainer.createSpan({ text: icon });
        iconSpan.style.marginRight = '4px';
      }

      // Add heading text
      itemContainer.createSpan({ text: displayText });

      // Add dropdown indicator (▼) for sibling navigation
      const dropdown = itemContainer.createSpan({
        text: '▼',
        cls: 'dashreader-breadcrumb-dropdown'
      });

      // Click on text -> navigate to heading
      itemContainer.addEventListener('click', (e) => {
        if (e.target !== dropdown) {
          this.navigateToHeading(heading.wordIndex);
        }
      });

      // Click on dropdown -> show siblings menu
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHeadingMenu(heading, itemContainer);
      });
    });

    this.lastHeadingContext = context;
  }

  /**
   * Closes all open menus (heading and outline menus)
   * Called before opening a new menu to ensure only one menu is visible
   */
  private closeAllMenus(): void {
    // Remove all heading menus
    document.querySelectorAll('.dashreader-heading-menu').forEach(menu => {
      menu.remove();
    });

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
   * Shows dropdown menu with sibling headings (same level under same parent)
   *
   * @param currentHeading - The heading whose siblings to show
   * @param anchorEl - The element to position the menu relative to
   */
  private showHeadingMenu(currentHeading: HeadingInfo, anchorEl: HTMLElement): void {
    // Close any existing menus first
    this.closeAllMenus();

    // Get siblings (same level headings under the same parent)
    const allHeadings = this.engine.getHeadings();

    // Find parent of current heading (last heading before current with level < current.level)
    let parentHeading: HeadingInfo | null = null;
    let currentIndex = -1;

    for (let i = 0; i < allHeadings.length; i++) {
      if (allHeadings[i].wordIndex === currentHeading.wordIndex) {
        currentIndex = i;
        break;
      }
    }

    // Look backwards from current to find parent
    if (currentIndex > 0) {
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (allHeadings[i].level < currentHeading.level) {
          parentHeading = allHeadings[i];
          break;
        }
      }
    }

    // Find all siblings: same level, between parent and next sibling of parent
    const siblings: HeadingInfo[] = [];

    for (let i = 0; i < allHeadings.length; i++) {
      const heading = allHeadings[i];

      // Must be same level as current
      if (heading.level !== currentHeading.level) {
        continue;
      }

      // Must come after parent (or at start if no parent)
      if (parentHeading && heading.wordIndex <= parentHeading.wordIndex) {
        continue;
      }

      // Must come before next heading at parent's level or higher
      // Find the next heading that closes the parent's section
      let isUnderSameParent = true;
      if (parentHeading) {
        // Look for any heading at parent level or higher that comes after parent
        for (let j = 0; j < allHeadings.length; j++) {
          const other = allHeadings[j];

          // Is this a heading at parent's level or higher (less deep)?
          if (other.level <= parentHeading.level &&
              other.wordIndex > parentHeading.wordIndex) {
            // If our heading comes at or after this boundary, it's not a sibling
            if (heading.wordIndex >= other.wordIndex) {
              isUnderSameParent = false;
              break;
            }
          }
        }
      }

      if (isUnderSameParent) {
        siblings.push(heading);
      }
    }

    if (siblings.length <= 1) {
      // No other siblings, nothing to navigate to
      return;
    }

    // Create menu using MenuBuilder
    MenuBuilder.createMenu({
      anchorEl: anchorEl,
      cssClass: 'dashreader-heading-menu',
      items: siblings.map(h => ({
        text: h.text,
        wordIndex: h.wordIndex,
        level: h.level,
        isCurrent: h.wordIndex === currentHeading.wordIndex
      })),
      onItemClick: (wordIndex) => this.navigateToHeading(wordIndex),
      showLevel: false,
      indentByLevel: false
    });
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
