/**
 * AutoLoadManager - Manages automatic text loading from editor
 *
 * Encapsulates the complex logic of tracking cursor position, text selection,
 * and file changes to automatically load content into DashReader.
 *
 * This extracts 170+ lines from setupAutoLoad() into a dedicated, testable class.
 */

import { App, MarkdownView, TFile } from 'obsidian';
import { TEXT_LIMITS, TIMING } from './constants';

export interface LoadTextCallback {
  (text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }): void;
}

export interface AutoLoadState {
  lastSelection: string;
  lastFilePath: string;
  lastCursorPosition: number;
  lastCheckTime: number;
}

/**
 * Checks if a keyboard event is a navigation key
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
 */
export function isSelectionKey(evt: KeyboardEvent): boolean {
  return evt.shiftKey || (evt.key === 'a' && (evt.metaKey || evt.ctrlKey));
}

/**
 * Extracts text content and metadata from the active markdown editor
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

/**
 * AutoLoadManager handles automatic text loading from the editor
 */
export class AutoLoadManager {
  private state: AutoLoadState;
  private app: App;
  private loadTextCallback: LoadTextCallback;
  private isViewShown: () => boolean;

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
   * Includes throttling to avoid excessive checks
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
   * Load content from the active editor
   * Used by file-open and leaf-change events
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
   */
  resetForNewFile(filePath: string): void {
    this.state.lastSelection = '';
    this.state.lastFilePath = filePath;
    this.state.lastCursorPosition = -1;
  }

  /**
   * Check if the file has changed
   */
  hasFileChanged(filePath: string): boolean {
    return filePath !== this.state.lastFilePath;
  }

  /**
   * Get current state (for debugging)
   */
  getState(): Readonly<AutoLoadState> {
    return { ...this.state };
  }
}
