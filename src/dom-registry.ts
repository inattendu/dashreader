/**
 * @file dom-registry.ts
 * @description DOMRegistry - Centralized DOM element storage and updates
 *
 * PURPOSE
 * ───────
 * Eliminates the need for repeated querySelector calls throughout the view.
 * Stores DOM element references once during UI construction and provides
 * typed, efficient update methods.
 *
 * **Problem Solved**: Before extraction, rsvp-view.ts used querySelector
 * 15+ times per update cycle (e.g., every word displayed). This caused:
 * - Performance issues due to repeated DOM traversal
 * - Brittle code with scattered selector strings
 * - Difficult maintenance when CSS classes changed
 *
 * **Solution**: Register elements once, update via registry:
 * - Single registration during buildUI()
 * - Type-safe keys prevent typos
 * - Batch update methods for efficiency
 * - Centralized class/style/content updates
 *
 * ARCHITECTURE
 * ────────────
 * **Registry Pattern**:
 * - Map-based storage: key → HTMLElement
 * - Type-safe keys via DOMElementKey union type
 * - Fluent API for common operations
 *
 * **Update Methods**:
 * - updateText() - Change text content safely (no XSS risk)
 * - updateHTML() - Change HTML content (use with caution, escape first)
 * - updateStyle() - Modify CSS properties
 * - toggleClass() - Show/hide elements, change appearance
 * - Batch methods: updateMultipleText(), toggleMultipleVisibility()
 *
 * **Integration with View**:
 * ```typescript
 * // Register during UI construction
 * const wpmValue = controlGroup.createSpan({ cls: CSS_CLASSES.wpmValue });
 * this.dom.register('wpmValue', wpmValue);
 *
 * // Update later
 * this.dom.updateText('wpmValue', '350');
 * ```
 *
 * OUTLINE
 * ───────
 * ├─ 1. TYPES
 * │  └─ DOMElementKey - Union type of all registered element keys
 * └─ 2. DOMREGISTRY CLASS
 *    ├─ register() - Store element reference by key
 *    ├─ get() - Retrieve stored element
 *    ├─ has() - Check if element is registered
 *    ├─ clear() - Clear all registrations
 *    ├─ updateText() - Update text content
 *    ├─ updateHTML() - Update HTML content (use with caution)
 *    ├─ updateStyle() - Update CSS property
 *    ├─ toggleClass() - Toggle CSS class
 *    ├─ addClass() - Add CSS class
 *    ├─ removeClass() - Remove CSS class
 *    ├─ empty() - Clear element contents
 *    ├─ updateMultipleText() - Batch text updates
 *    └─ toggleMultipleVisibility() - Batch visibility toggles
 *
 * @version 1.3.1
 * @author DashReader Team
 */

// ============================================================================
// 1. TYPES
// ============================================================================

import { CSS_CLASSES } from './constants';

/**
 * Union type of all registered DOM element keys
 *
 * Type-safe keys prevent typos and enable IDE autocomplete.
 * If you add a new element to register, add its key here.
 */
type DOMElementKey =
  | 'wpmValue'          // WPM value display in controls
  | 'wpmInlineValue'    // WPM value in inline settings
  | 'wpmDisplay'        // WPM display in stats panel
  | 'chunkValue'        // Chunk size value display
  | 'fontValue'         // Font size value display
  | 'accelDurationValue' // Acceleration duration value
  | 'accelTargetValue'  // Acceleration target WPM value
  | 'statsText'         // Statistics text element
  | 'progressBar'       // Reading progress bar
  | 'wordEl'            // Main word display element
  | 'contextBeforeEl'   // Context before current word
  | 'contextAfterEl'    // Context after current word
  | 'playBtn'           // Play button
  | 'pauseBtn'          // Pause button
  | 'controlsEl'        // Controls panel container
  | 'settingsEl'        // Settings panel container
  | 'statsEl';          // Stats panel container

// ============================================================================
// 2. DOMREGISTRY CLASS
// ============================================================================

/**
 * Registry for storing and updating DOM element references
 *
 * Centralizes DOM element storage and provides type-safe update methods.
 * Eliminates performance issues from repeated querySelector calls.
 *
 * **Usage Pattern**:
 * 1. Register elements during UI construction: `register(key, element)`
 * 2. Update elements later: `updateText(key, value)` or `toggleClass(key, class, visible)`
 * 3. Batch updates for efficiency: `updateMultipleText({key1: val1, key2: val2})`
 *
 * @example
 * ```typescript
 * // Initialize registry
 * const dom = new DOMRegistry();
 *
 * // Register elements during UI construction
 * const wpmDisplay = container.createDiv({ cls: CSS_CLASSES.wpmDisplay });
 * dom.register('wpmDisplay', wpmDisplay);
 *
 * // Update later (no querySelector needed!)
 * dom.updateText('wpmDisplay', '350 WPM');
 * dom.toggleClass('controlsEl', CSS_CLASSES.hidden, false); // Show controls
 * ```
 */
export class DOMRegistry {
  private elements = new Map<DOMElementKey, HTMLElement>();

  /**
   * Register a DOM element by key
   *
   * Stores an element reference for later retrieval and updates. Should be
   * called once per element during UI construction.
   *
   * @param key - Type-safe key for the element (from DOMElementKey union)
   * @param element - HTMLElement to store
   *
   * @example
   * ```typescript
   * const wpmValue = controlGroup.createSpan({ cls: CSS_CLASSES.wpmValue });
   * this.dom.register('wpmValue', wpmValue);
   * ```
   */
  register(key: DOMElementKey, element: HTMLElement): void {
    this.elements.set(key, element);
  }

  /**
   * Get a registered DOM element
   *
   * Retrieves the stored element reference. Returns undefined if the key
   * was never registered.
   *
   * @param key - Key of the element to retrieve
   * @returns The HTMLElement if registered, undefined otherwise
   *
   * @example
   * ```typescript
   * const wpmEl = this.dom.get('wpmValue');
   * if (wpmEl) {
   *   // Do something with the element
   * }
   * ```
   */
  get(key: DOMElementKey): HTMLElement | undefined {
    return this.elements.get(key);
  }

  /**
   * Update text content of a registered element (XSS-safe)
   *
   * Uses Obsidian's setText() method which safely escapes HTML.
   * Preferred over updateHTML() for displaying user-generated content.
   *
   * @param key - Key of the element to update
   * @param text - Text content to set (string or number)
   *
   * @example
   * ```typescript
   * this.dom.updateText('wpmValue', 350);
   * this.dom.updateText('statsText', 'Words: 42 / 1000');
   * ```
   */
  updateText(key: DOMElementKey, text: string | number): void {
    const element = this.elements.get(key);
    if (element) {
      element.setText(String(text));
    }
  }

  /**
   * Update HTML content of a registered element
   *
   * **⚠️ WARNING**: Use with caution! Ensure content is properly escaped to
   * prevent XSS attacks. Prefer updateText() for plain text content.
   *
   * Only use this when you need to render HTML markup (e.g., syntax highlighting,
   * formatted text with spans, etc.) and you're certain the content is safe.
   *
   * @param key - Key of the element to update
   * @param html - HTML string to set (MUST be escaped if user-generated)
   *
   * @example
   * ```typescript
   * // Safe: Generated HTML with no user input
   * this.dom.updateHTML('wordEl', `<span class="highlight">Word</span>`);
   *
   * // UNSAFE: Never do this with user content
   * // this.dom.updateHTML('wordEl', userInput); // ❌ XSS risk!
   * ```
   */
  updateHTML(key: DOMElementKey, html: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.innerHTML = html;
    }
  }

  /**
   * Update a CSS style property of a registered element
   *
   * Modifies inline styles. Useful for dynamic styling like font size,
   * colors, or positioning.
   *
   * @param key - Key of the element to update
   * @param property - CSS property name (camelCase, e.g., 'fontSize')
   * @param value - CSS value as string (e.g., '48px', '#ff0000')
   *
   * @example
   * ```typescript
   * this.dom.updateStyle('wordEl', 'fontSize', '48px');
   * this.dom.updateStyle('wordEl', 'color', '#ff0000');
   * this.dom.updateStyle('progressBar', 'width', '50%');
   * ```
   */
  updateStyle(key: DOMElementKey, property: string, value: string): void {
    const element = this.elements.get(key);
    if (element) {
      (element.style as any)[property] = value;
    }
  }

  /**
   * Toggle CSS class on a registered element
   *
   * Conditionally adds or removes a CSS class. Commonly used for show/hide
   * functionality with CSS_CLASSES.hidden.
   *
   * @param key - Key of the element to update
   * @param className - CSS class name to toggle
   * @param force - True to add class, false to remove it
   *
   * @example
   * ```typescript
   * // Show controls (remove 'hidden' class)
   * this.dom.toggleClass('controlsEl', CSS_CLASSES.hidden, false);
   *
   * // Hide controls (add 'hidden' class)
   * this.dom.toggleClass('controlsEl', CSS_CLASSES.hidden, true);
   * ```
   */
  toggleClass(key: DOMElementKey, className: string, force: boolean): void {
    const element = this.elements.get(key);
    if (element) {
      element.toggleClass(className, force);
    }
  }

  /**
   * Add CSS class to a registered element
   *
   * Adds a CSS class if not already present. Use for state changes like
   * highlighting, active states, etc.
   *
   * @param key - Key of the element to update
   * @param className - CSS class name to add
   *
   * @example
   * ```typescript
   * this.dom.addClass('playBtn', 'active');
   * this.dom.addClass('wordEl', CSS_CLASSES.highlight);
   * ```
   */
  addClass(key: DOMElementKey, className: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.classList.add(className);
    }
  }

  /**
   * Remove CSS class from a registered element
   *
   * Removes a CSS class if present. Use for removing state classes.
   *
   * @param key - Key of the element to update
   * @param className - CSS class name to remove
   *
   * @example
   * ```typescript
   * this.dom.removeClass('playBtn', 'active');
   * this.dom.removeClass('wordEl', CSS_CLASSES.highlight);
   * ```
   */
  removeClass(key: DOMElementKey, className: string): void {
    const element = this.elements.get(key);
    if (element) {
      element.classList.remove(className);
    }
  }

  /**
   * Empty the content of a registered element
   *
   * Removes all child nodes and text content. Useful for clearing containers
   * before re-rendering.
   *
   * @param key - Key of the element to empty
   *
   * @example
   * ```typescript
   * // Clear the word display before loading new text
   * this.dom.empty('wordEl');
   * ```
   */
  empty(key: DOMElementKey): void {
    const element = this.elements.get(key);
    if (element) {
      element.empty();
    }
  }

  /**
   * Check if an element is registered
   *
   * Returns true if an element with the given key has been registered.
   *
   * @param key - Key to check
   * @returns True if the key is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (this.dom.has('statsEl')) {
   *   this.dom.updateText('statsEl', 'New stats');
   * }
   * ```
   */
  has(key: DOMElementKey): boolean {
    return this.elements.has(key);
  }

  /**
   * Clear all registered elements
   *
   * Removes all element references from the registry. Typically used during
   * cleanup or when rebuilding the entire UI.
   *
   * @example
   * ```typescript
   * // During onunload
   * this.dom.clear();
   * ```
   */
  clear(): void {
    this.elements.clear();
  }

  /**
   * Update multiple text elements at once (batch update)
   *
   * Efficiently updates text content of multiple elements in a single call.
   * More readable than multiple individual updateText() calls.
   *
   * @param updates - Object mapping element keys to new text values
   *
   * @example
   * ```typescript
   * // Update all WPM displays at once
   * this.dom.updateMultipleText({
   *   wpmDisplay: `${wpm} WPM`,
   *   wpmValue: String(wpm),
   *   wpmInlineValue: String(wpm)
   * });
   *
   * // Update stats panel
   * this.dom.updateMultipleText({
   *   statsText: `Words: ${wordsRead} / ${totalWords}`,
   *   progressBar: `${percent}%`
   * });
   * ```
   */
  updateMultipleText(updates: Partial<Record<DOMElementKey, string | number>>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        this.updateText(key as DOMElementKey, value);
      }
    });
  }

  /**
   * Toggle visibility of multiple elements (batch visibility)
   *
   * Efficiently shows or hides multiple elements using CSS_CLASSES.hidden.
   * More readable than multiple individual toggleClass() calls.
   *
   * @param toggles - Object mapping element keys to visibility booleans (true = visible, false = hidden)
   *
   * @example
   * ```typescript
   * // Show play button, hide pause button
   * this.dom.toggleMultipleVisibility({
   *   playBtn: true,
   *   pauseBtn: false
   * });
   *
   * // Hide all panels
   * this.dom.toggleMultipleVisibility({
   *   controlsEl: false,
   *   settingsEl: false,
   *   statsEl: false
   * });
   * ```
   */
  toggleMultipleVisibility(toggles: Partial<Record<DOMElementKey, boolean>>): void {
    Object.entries(toggles).forEach(([key, visible]) => {
      if (typeof visible === 'boolean') {
        this.toggleClass(key as DOMElementKey, CSS_CLASSES.hidden, !visible);
      }
    });
  }
}
