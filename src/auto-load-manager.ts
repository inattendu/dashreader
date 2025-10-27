/**
 * @file auto-load-manager.ts
 * @description AutoLoadManager - Manages automatic text loading from editor
 *
 * PURPOSE
 * ───────
 * Encapsulates the complex logic of tracking cursor position, text selection,
 * and file changes to automatically load content into DashReader.
 *
 * This class was extracted from a 170-line setupAutoLoad() method in rsvp-view.ts
 * to improve:
 * - Testability: Isolated logic can be unit tested
 * - Readability: Clear class structure vs nested callbacks
 * - Maintainability: Single responsibility principle
 * - Reusability: Could be used by other speed reading views
 *
 * ARCHITECTURE
 * ────────────
 * The AutoLoadManager operates in three modes:
 *
 * 1. **Selection Mode**: User selects text → load selection immediately
 * 2. **Cursor Mode**: User moves cursor → load full document from cursor position
 * 3. **File Change Mode**: User opens new file → load content with delay
 *
 * State tracking prevents redundant loads:
 * - lastSelection: Prevents reloading same selection
 * - lastCursorPosition: Prevents reloading on tiny cursor movements
 * - lastFilePath: Detects file changes
 * - lastCheckTime: Throttles checks to 150ms intervals
 *
 * Integration with Obsidian:
 * - Listens to editor events (mouseup, keyup, active-leaf-change, file-open)
 * - Extracts content from MarkdownView using editor API
 * - Respects TEXT_LIMITS and TIMING constants
 *
 * OUTLINE
 * ───────
 * ├─ 1. IMPORTS & INTERFACES
 * │  ├─ LoadTextCallback - Callback for loading text into view
 * │  └─ AutoLoadState - State tracking interface
 * ├─ 2. HELPER FUNCTIONS
 * │  ├─ isNavigationKey() - Detects arrow keys, Home/End, Vim keys
 * │  ├─ isSelectionKey() - Detects Shift and Cmd+A
 * │  └─ extractEditorContent() - Extracts text and metadata from active editor
 * └─ 3. AUTOLOADMANAGER CLASS
 *    ├─ constructor() - Initialize with app, callback, visibility check
 *    ├─ checkSelectionOrCursor() - Main logic for selection/cursor tracking
 *    ├─ loadFromEditor() - Load content with delay (file-open, leaf-change)
 *    ├─ resetForNewFile() - Reset state when file changes
 *    ├─ hasFileChanged() - Check if file path changed
 *    └─ getState() - Debug accessor for current state
 *
 * @version 1.3.1
 * @author DashReader Team
 */

// ============================================================================
// 1. IMPORTS & INTERFACES
// ============================================================================

import { App, MarkdownView, TFile } from 'obsidian';
import { TEXT_LIMITS, TIMING } from './constants';

/**
 * Callback function for loading text into DashReader view
 *
 * @param text - The text content to load (selection or full document)
 * @param source - Optional source metadata
 * @param source.fileName - Name of the file being read
 * @param source.lineNumber - Line number where selection starts (for selections)
 * @param source.cursorPosition - Character offset of cursor (for full document loads)
 */
export interface LoadTextCallback {
  (text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }): void;
}

/**
 * State tracking interface for AutoLoadManager
 *
 * Tracks previous values to prevent redundant loads and detect changes.
 */
export interface AutoLoadState {
  /** Last selected text (empty string if no selection) */
  lastSelection: string;
  /** Path of the last active file */
  lastFilePath: string;
  /** Last cursor position as character offset (-1 if uninitialized) */
  lastCursorPosition: number;
  /** Timestamp of last check in milliseconds (for throttling) */
  lastCheckTime: number;
}

// ============================================================================
// 2. HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a keyboard event is a navigation key
 *
 * Detects keys that move the cursor without modifying text. Used to determine
 * if cursor position change should trigger a reload from the new position.
 *
 * Supported navigation keys:
 * - Arrow keys (Up, Down, Left, Right)
 * - Home, End (start/end of line)
 * - PageUp, PageDown (page scrolling)
 * - Enter (new line)
 * - Vim-style: Ctrl+j (down), Ctrl+k (up), Ctrl+d (half page down), Ctrl+u (half page up)
 * - Cmd/Ctrl + Up/Down (start/end of document)
 *
 * @param evt - Keyboard event to check
 * @returns True if the key is a navigation key, false otherwise
 *
 * @example
 * ```typescript
 * document.addEventListener('keyup', (evt) => {
 *   if (isNavigationKey(evt)) {
 *     // Cursor moved, check if we should reload
 *     autoLoadManager.checkSelectionOrCursor();
 *   }
 * });
 * ```
 */
export function isNavigationKey(evt: KeyboardEvent): boolean {
  return (
    // Arrow keys
    evt.key === 'ArrowUp' || evt.key === 'ArrowDown' ||
    evt.key === 'ArrowLeft' || evt.key === 'ArrowRight' ||
    // Home/End/PageUp/PageDown
    evt.key === 'Home' || evt.key === 'End' ||
    evt.key === 'PageUp' || evt.key === 'PageDown' ||
    // Enter
    evt.key === 'Enter' ||
    // Vim-style navigation
    (evt.key === 'j' && evt.ctrlKey) || (evt.key === 'k' && evt.ctrlKey) ||
    (evt.key === 'd' && evt.ctrlKey) || (evt.key === 'u' && evt.ctrlKey) ||
    // Cmd/Ctrl + arrows
    ((evt.key === 'ArrowUp' || evt.key === 'ArrowDown') && (evt.metaKey || evt.ctrlKey))
  );
}

/**
 * Checks if a keyboard event is a selection key
 *
 * Detects keys that create or modify text selections. Used to determine
 * if a selection change should trigger a reload of the selected text.
 *
 * Supported selection keys:
 * - Shift (when combined with any key)
 * - Cmd+A / Ctrl+A (select all)
 *
 * @param evt - Keyboard event to check
 * @returns True if the key is a selection key, false otherwise
 *
 * @example
 * ```typescript
 * document.addEventListener('keyup', (evt) => {
 *   if (isSelectionKey(evt)) {
 *     // Selection might have changed, check it
 *     autoLoadManager.checkSelectionOrCursor();
 *   }
 * });
 * ```
 */
export function isSelectionKey(evt: KeyboardEvent): boolean {
  return evt.shiftKey || (evt.key === 'a' && (evt.metaKey || evt.ctrlKey));
}

/**
 * Extracts text content and metadata from the active markdown editor
 *
 * Gets the current state of the active MarkdownView including:
 * - Selected text (if any)
 * - Full document content
 * - Cursor position (character offset)
 * - Line number (for selections)
 * - File name
 *
 * Used by AutoLoadManager to determine what content to load into DashReader.
 *
 * @param app - Obsidian App instance
 * @returns Object containing editor content and metadata:
 *   - activeView: The active MarkdownView (null if no markdown file is open)
 *   - currentFile: The active TFile (null if no file)
 *   - fileName: Name of the active file
 *   - selection: Selected text (only if something is selected)
 *   - fullContent: Full document content
 *   - cursorPosition: Cursor position as character offset from start
 *   - lineNumber: Line number where selection starts (1-indexed, only for selections)
 *
 * @example
 * ```typescript
 * const content = extractEditorContent(this.app);
 * if (content.selection) {
 *   // User has text selected
 *   console.log(`Loading ${content.selection.length} chars from line ${content.lineNumber}`);
 * } else if (content.fullContent) {
 *   // Load full document from cursor position
 *   console.log(`Loading full document from position ${content.cursorPosition}`);
 * }
 * ```
 */
export function extractEditorContent(
  app: App
): {
  activeView: MarkdownView | null;
  currentFile: TFile | null;
  fileName?: string;
  selection?: string;
  fullContent?: string;
  cursorPosition?: number;
  lineNumber?: number;
} {
  const activeView = app.workspace.getActiveViewOfType(MarkdownView);
  if (!activeView) {
    return { activeView: null, currentFile: null };
  }

  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    return { activeView, currentFile: null };
  }

  const fileName = currentFile.name;
  const editor = activeView.editor;

  // Check for selection
  let selection: string | undefined;
  let lineNumber: number | undefined;
  if (editor.somethingSelected()) {
    selection = editor.getSelection();
    const cursor = editor.getCursor('from');
    lineNumber = cursor.line + 1;
  }

  // Get full content and cursor position
  const fullContent = editor.getValue();
  const cursor = editor.getCursor();
  const cursorPosition = editor.posToOffset(cursor);

  return {
    activeView,
    currentFile,
    fileName,
    selection,
    fullContent,
    cursorPosition,
    lineNumber,
  };
}

// ============================================================================
// 3. AUTOLOADMANAGER CLASS
// ============================================================================

/**
 * AutoLoadManager handles automatic text loading from the editor
 *
 * Manages the complex state tracking and event handling required to automatically
 * load content into DashReader as the user navigates and selects text.
 *
 * **Extraction History**: This class was extracted from a 170-line setupAutoLoad()
 * method in rsvp-view.ts to improve testability and maintainability.
 *
 * **Key Responsibilities**:
 * - Track selection changes and load selected text
 * - Track cursor position changes and reload from new position
 * - Throttle checks to prevent performance issues (150ms interval)
 * - Detect file changes and reset state
 * - Provide delayed loading for file-open and leaf-change events
 *
 * **State Management**:
 * - lastSelection: Prevents reloading identical selections
 * - lastCursorPosition: Prevents reload on tiny movements
 * - lastFilePath: Detects file switches
 * - lastCheckTime: Implements throttling
 *
 * @example
 * ```typescript
 * // Initialize in view
 * this.autoLoadManager = new AutoLoadManager(
 *   this.app,
 *   (text, source) => this.loadText(text, source),
 *   () => this.isViewShown
 * );
 *
 * // Use in event handlers
 * this.registerDomEvent(document, 'keyup', (evt) => {
 *   if (isNavigationKey(evt) || isSelectionKey(evt)) {
 *     this.autoLoadManager.checkSelectionOrCursor();
 *   }
 * });
 *
 * // Use in file-open event
 * this.registerEvent(
 *   this.app.workspace.on('file-open', () => {
 *     this.autoLoadManager.loadFromEditor(300);
 *   })
 * );
 * ```
 */
export class AutoLoadManager {
  private state: AutoLoadState;
  private app: App;
  private loadTextCallback: LoadTextCallback;
  private isViewShown: () => boolean;

  /**
   * Creates a new AutoLoadManager instance
   *
   * @param app - Obsidian App instance for accessing workspace and editor
   * @param loadTextCallback - Callback function to load text into DashReader view
   * @param isViewShown - Function that returns true if DashReader view is currently visible
   *
   * @example
   * ```typescript
   * this.autoLoadManager = new AutoLoadManager(
   *   this.app,
   *   (text, source) => this.loadText(text, source),
   *   () => this.isViewShown
   * );
   * ```
   */
  constructor(
    app: App,
    loadTextCallback: LoadTextCallback,
    isViewShown: () => boolean
  ) {
    this.app = app;
    this.loadTextCallback = loadTextCallback;
    this.isViewShown = isViewShown;
    this.state = {
      lastSelection: '',
      lastFilePath: '',
      lastCursorPosition: -1,
      lastCheckTime: 0,
    };
  }

  /**
   * Check for selection or cursor changes and load text if needed
   *
   * This is the main method called by keyboard and mouse event handlers.
   * It implements throttling (150ms) to avoid performance issues from
   * rapid event firing.
   *
   * **Logic Flow**:
   * 1. Throttle: Skip if less than 150ms since last check
   * 2. Extract editor content (selection, cursor position, etc.)
   * 3. Priority 1: If selection exists and changed → load selection
   * 4. Priority 2: If cursor moved → reload from new cursor position
   *
   * **Prevents Redundant Loads**:
   * - Tracks lastSelection to avoid reloading same text
   * - Tracks lastCursorPosition to avoid reload on unchanged position
   *
   * **Typical Usage**: Called on keyup and mouseup events
   *
   * @example
   * ```typescript
   * // In rsvp-view.ts setupAutoLoad()
   * this.registerDomEvent(document, 'keyup', (evt) => {
   *   if (isNavigationKey(evt) || isSelectionKey(evt)) {
   *     this.autoLoadManager.checkSelectionOrCursor();
   *   }
   * });
   *
   * this.registerDomEvent(document, 'mouseup', () => {
   *   this.autoLoadManager.checkSelectionOrCursor();
   * });
   * ```
   */
  checkSelectionOrCursor(): void {
    // Throttle checks
    const now = Date.now();
    if (now - this.state.lastCheckTime < TIMING.throttleDelay) {
      return;
    }
    this.state.lastCheckTime = now;

    const content = extractEditorContent(this.app);
    if (!content.activeView || !content.currentFile) {
      return;
    }

    // Case 1: Selection exists
    if (content.selection && content.selection.length > TEXT_LIMITS.minSelectionLength) {
      if (content.selection !== this.state.lastSelection) {
        this.state.lastSelection = content.selection;
        console.log(
          'DashReader: Auto-loading selection',
          content.selection.length,
          'characters from',
          content.fileName,
          'line',
          content.lineNumber
        );
        this.loadTextCallback(content.selection, {
          fileName: content.fileName,
          lineNumber: content.lineNumber,
        });
      }
      return;
    }

    // Case 2: No selection - reload from cursor position
    if (content.fullContent && content.fullContent.trim().length > TEXT_LIMITS.minContentLength) {
      if (content.cursorPosition !== this.state.lastCursorPosition) {
        const positionDiff = Math.abs(content.cursorPosition! - this.state.lastCursorPosition);
        console.log(
          'DashReader: Cursor moved from',
          this.state.lastCursorPosition,
          'to',
          content.cursorPosition,
          '(diff:',
          positionDiff,
          ')'
        );
        console.log(
          'DashReader: Reloading from cursor position',
          content.cursorPosition,
          'in',
          content.fileName
        );
        this.loadTextCallback(content.fullContent, {
          fileName: content.fileName,
          cursorPosition: content.cursorPosition,
        });
        this.state.lastSelection = '';
        this.state.lastCursorPosition = content.cursorPosition!;
      }
    }
  }

  /**
   * Load content from the active editor with a configurable delay
   *
   * Used by file-open and leaf-change events to load content after a short
   * delay, giving Obsidian time to fully activate the editor.
   *
   * **Priority Logic**:
   * 1. If text is selected → load selection (rare on file open)
   * 2. Otherwise → load full document from cursor position
   *
   * **Delay Rationale**:
   * - file-open: 300ms default - editor needs time to initialize
   * - leaf-change: Can use shorter delay (200ms) - editor already active
   *
   * @param delay - Delay in milliseconds before loading (default: 300ms from TIMING.autoLoadDelay)
   *
   * @example
   * ```typescript
   * // File-open event (use default 300ms delay)
   * this.registerEvent(
   *   this.app.workspace.on('file-open', () => {
   *     this.autoLoadManager.loadFromEditor();
   *   })
   * );
   *
   * // Leaf-change event (use shorter 200ms delay)
   * this.registerEvent(
   *   this.app.workspace.on('active-leaf-change', () => {
   *     this.autoLoadManager.loadFromEditor(TIMING.autoLoadDelayShort);
   *   })
   * );
   * ```
   */
  loadFromEditor(delay: number = TIMING.autoLoadDelay): void {
    setTimeout(() => {
      if (!this.isViewShown()) return;

      const content = extractEditorContent(this.app);
      if (!content.activeView || !content.currentFile) return;

      // Priority 1: Load selection if exists
      if (content.selection && content.selection.length > TEXT_LIMITS.minSelectionLength) {
        console.log(
          'DashReader: Auto-loading selection',
          content.selection.length,
          'characters from line',
          content.lineNumber
        );
        this.loadTextCallback(content.selection, {
          fileName: content.fileName,
          lineNumber: content.lineNumber,
        });
        return;
      }

      // Priority 2: Load full content from cursor position
      if (content.fullContent && content.fullContent.trim().length > TEXT_LIMITS.minContentLength) {
        console.log('DashReader: Auto-loading entire page from cursor position', content.cursorPosition);
        this.loadTextCallback(content.fullContent, {
          fileName: content.fileName,
          cursorPosition: content.cursorPosition,
        });
      }
    }, delay);
  }

  /**
   * Reset tracking state for a new file
   *
   * Called when the active file changes to clear previous selection and
   * cursor tracking. This prevents attempting to reload content from the
   * previous file's state.
   *
   * @param filePath - Path of the newly opened file
   *
   * @example
   * ```typescript
   * this.registerEvent(
   *   this.app.workspace.on('file-open', (file) => {
   *     if (file && this.autoLoadManager.hasFileChanged(file.path)) {
   *       this.autoLoadManager.resetForNewFile(file.path);
   *       this.autoLoadManager.loadFromEditor();
   *     }
   *   })
   * );
   * ```
   */
  resetForNewFile(filePath: string): void {
    this.state.lastSelection = '';
    this.state.lastFilePath = filePath;
    this.state.lastCursorPosition = -1;
  }

  /**
   * Check if the file has changed
   *
   * Compares the given file path with the last tracked file path to determine
   * if the user has switched to a different file.
   *
   * @param filePath - File path to check
   * @returns True if the file path is different from the last tracked path
   *
   * @example
   * ```typescript
   * if (this.autoLoadManager.hasFileChanged(currentFile.path)) {
   *   console.log('User switched to a different file');
   *   this.autoLoadManager.resetForNewFile(currentFile.path);
   * }
   * ```
   */
  hasFileChanged(filePath: string): boolean {
    return filePath !== this.state.lastFilePath;
  }

  /**
   * Get current state (for debugging)
   *
   * Returns a readonly copy of the internal state for debugging purposes.
   * Useful for understanding why auto-load is or isn't triggering.
   *
   * @returns Readonly copy of the current AutoLoadState
   *
   * @example
   * ```typescript
   * const state = this.autoLoadManager.getState();
   * console.log('AutoLoad state:', {
   *   lastSelection: state.lastSelection.substring(0, 50) + '...',
   *   lastFilePath: state.lastFilePath,
   *   lastCursorPosition: state.lastCursorPosition,
   *   lastCheckTime: new Date(state.lastCheckTime).toISOString()
   * });
   * ```
   */
  getState(): Readonly<AutoLoadState> {
    return { ...this.state };
  }
}
