/**
 * DOMRegistry - Centralized DOM element storage and updates
 *
 * Eliminates the need for repeated querySelector calls throughout the view.
 * Stores references once and provides typed update methods.
 */

import { CSS_CLASSES } from './constants';

type DOMElementKey =
  | 'wpmValue'
  | 'wpmInlineValue'
  | 'wpmDisplay'
  | 'chunkValue'
  | 'fontValue'
  | 'accelDurationValue'
  | 'accelTargetValue'
  | 'statsText'
  | 'progressBar'
  | 'wordEl'
  | 'contextBeforeEl'
  | 'contextAfterEl'
  | 'playBtn'
  | 'pauseBtn'
  | 'controlsEl'
  | 'settingsEl'
  | 'statsEl';

/**
 * Registry for storing and updating DOM element references
 */
export class DOMRegistry {
  private elements = new Map<DOMElementKey, HTMLElement>();

  /**
   * Register a DOM element by key
   */
  register(key: DOMElementKey, element: HTMLElement): void {
    this.elements.set(key, element);
  }

  /**
   * Get a registered DOM element
   */
  get(key: DOMElementKey): HTMLElement | undefined {
    return this.elements.get(key);
  }

  /**
   * Update text content of a registered element
   */
  updateText(key: DOMElementKey, text: string | number): void {
    const element = this.elements.get(key);
    if (element) {
      element.setText(String(text));
    }
  }

  /**
   * Update HTML content of a registered element (use with caution - ensure content is escaped)
   */
  updateHTML(key: DOMElementKey, html: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.innerHTML = html;
    }
  }

  /**
   * Update style property of a registered element
   */
  updateStyle(key: DOMElementKey, property: string, value: string): void {
    const element = this.elements.get(key);
    if (element) {
      (element.style as any)[property] = value;
    }
  }

  /**
   * Toggle CSS class on a registered element
   * @param force - true to add class, false to remove it
   */
  toggleClass(key: DOMElementKey, className: string, force: boolean): void {
    const element = this.elements.get(key);
    if (element) {
      element.toggleClass(className, force);
    }
  }

  /**
   * Add CSS class to a registered element
   */
  addClass(key: DOMElementKey, className: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.classList.add(className);
    }
  }

  /**
   * Remove CSS class from a registered element
   */
  removeClass(key: DOMElementKey, className: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.classList.remove(className);
    }
  }

  /**
   * Empty the content of a registered element
   */
  empty(key: DOMElementKey): void {
    const element = this.elements.get(key);
    if (element) {
      element.empty();
    }
  }

  /**
   * Check if an element is registered
   */
  has(key: DOMElementKey): boolean {
    return this.elements.has(key);
  }

  /**
   * Clear all registered elements
   */
  clear(): void {
    this.elements.clear();
  }

  /**
   * Update multiple text elements at once
   */
  updateMultipleText(updates: Partial<Record<DOMElementKey, string | number>>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        this.updateText(key as DOMElementKey, value);
      }
    });
  }

  /**
   * Toggle visibility of multiple elements
   */
  toggleMultipleVisibility(toggles: Partial<Record<DOMElementKey, boolean>>): void {
    Object.entries(toggles).forEach(([key, visible]) => {
      if (typeof visible === 'boolean') {
        this.toggleClass(key as DOMElementKey, CSS_CLASSES.hidden, !visible);
      }
    });
  }
}
