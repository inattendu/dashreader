/**
 * @file rsvp-view.ts
 * @description Main view component for DashReader RSVP speed reading
 *
 * ARCHITECTURE:
 * This view implements a clean separation of concerns using utility classes:
 * - ViewState: Centralized reactive state management with event emission
 * - DOMRegistry: Efficient DOM element caching and batch updates
 * - AutoLoadManager: Automatic text loading from editor with cursor tracking
 * - UI Builders: Reusable component factories for consistent UI
 *
 * OUTLINE:
 * ├─ 1. IMPORTS & CONSTANTS
 * ├─ 2. CLASS DEFINITION
 * │  ├─ Properties & Constructor
 * │  └─ Obsidian View Lifecycle
 * ├─ 3. UI CONSTRUCTION
 * │  ├─ buildUI() orchestrator
 * │  ├─ buildToggleBar()
 * │  ├─ buildStats()
 * │  ├─ buildDisplayArea()
 * │  ├─ buildProgressBar()
 * │  ├─ buildControls()
 * │  └─ buildInlineSettings()
 * ├─ 4. USER INTERACTIONS
 * │  ├─ changeValue() - Unified value changes
 * │  ├─ togglePanel() - Panel visibility
 * │  ├─ toggleContextDisplay()
 * │  └─ openInNewTab() - Open in fullscreen tab
 * ├─ 5. AUTO-LOAD SYSTEM
 * │  └─ setupAutoLoad() - Event registration
 * ├─ 6. HOTKEYS & KEYBOARD
 * │  ├─ setupHotkeys()
 * │  ├─ handleKeyPress()
 * │  └─ togglePlay()
 * ├─ 7. READING ENGINE CALLBACKS
 * │  ├─ onWordChange()
 * │  ├─ displayWordWithHeading()
 * │  ├─ processWord()
 * │  ├─ onComplete()
 * │  └─ updateStats()
 * ├─ 8. TEXT LOADING
 * │  └─ loadText() - Main text loading method
 * └─ 9. SETTINGS & LIFECYCLE
 *    ├─ updateSettings()
 *    └─ onClose()
 *
 * @author DashReader Team
 * @version 2.0.0 - Refactored for maintainability
 */

// ============================================================================
// SECTION 1: IMPORTS & CONSTANTS
// ============================================================================

import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { RSVPEngine } from './rsvp-engine';
import { DashReaderSettings, WordChunk, HeadingContext, HeadingInfo } from './types';
import { MarkdownParser } from './markdown-parser';
import { ViewState } from './view-state';
import { DOMRegistry } from './dom-registry';
import {
  createButton,
  createNumberControl,
  createToggleControl,
  createPlayPauseButtons,
  updatePlayPauseButtons,
  createWelcomeMessage,
  createReadyMessage,
  formatTime,
  escapeHtml,
} from './ui-builders';
import {
  CSS_CLASSES,
  ICONS,
  TIMING,
  TEXT_LIMITS,
  INCREMENTS,
  LIMITS,
  HEADING_MULTIPLIERS,
} from './constants';
import { AutoLoadManager, isNavigationKey, isSelectionKey } from './auto-load-manager';

export const VIEW_TYPE_DASHREADER = 'dashreader-view';

// ============================================================================
// SECTION 2: CLASS DEFINITION
// ============================================================================

/**
 * Main view component for DashReader RSVP speed reading
 *
 * Implements Obsidian's ItemView interface to provide a custom view for
 * displaying text word-by-word at configurable speeds (WPM).
 *
 * @extends ItemView
 */
export class DashReaderView extends ItemView {
  // ──────────────────────────────────────────────────────────────────────
  // Core Dependencies
  // ──────────────────────────────────────────────────────────────────────

  /** RSVP reading engine - handles word iteration and timing */
  private engine: RSVPEngine;

  /** Plugin settings (WPM, font size, colors, etc.) */
  private settings: DashReaderSettings;

  /** Centralized reactive state manager */
  private state: ViewState;

  /** DOM element registry for efficient updates */
  private dom: DOMRegistry;

  /** Automatic text loading from editor */
  private autoLoadManager: AutoLoadManager;

  // ──────────────────────────────────────────────────────────────────────
  // DOM Element References
  // ──────────────────────────────────────────────────────────────────────

  /** Main container element */
  private mainContainerEl: HTMLElement;

  /** Toggle buttons bar (settings, stats) */
  private toggleBar: HTMLElement;

  /** Main word display area */
  private wordEl: HTMLElement;

  /** Context before current word */
  private contextBeforeEl: HTMLElement;

  /** Context after current word */
  private contextAfterEl: HTMLElement;

  /** Controls panel (play, pause, etc.) */
  private controlsEl: HTMLElement;

  /** Settings panel (inline configuration) */
  private settingsEl: HTMLElement;

  /** Progress bar container */
  private progressEl: HTMLElement;

  /** Stats display panel */
  private statsEl: HTMLElement;

  /** Breadcrumb navigation showing current heading context */
  private breadcrumbEl: HTMLElement;

  // ──────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Creates a new DashReaderView instance
   *
   * @param leaf - Obsidian workspace leaf to attach to
   * @param settings - Plugin settings
   */
  constructor(leaf: WorkspaceLeaf, settings: DashReaderSettings) {
    super(leaf);
    this.settings = settings;

    // Initialize state manager with current settings
    this.state = new ViewState({
      currentWpm: settings.wpm,
      currentChunkSize: settings.chunkSize,
      currentFontSize: settings.fontSize,
    });

    // Initialize DOM registry for efficient element updates
    this.dom = new DOMRegistry();

    // Initialize RSVP engine with callbacks
    this.engine = new RSVPEngine(
      settings,
      this.onWordChange.bind(this),
      this.onComplete.bind(this)
    );

    // Initialize auto-load manager for editor integration
    this.autoLoadManager = new AutoLoadManager(
      this.app,
      this.loadText.bind(this),
      () => this.mainContainerEl?.isShown() ?? false
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Obsidian View Lifecycle
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Returns the unique view type identifier
   * @returns View type string
   */
  getViewType(): string {
    return VIEW_TYPE_DASHREADER;
  }

  /**
   * Returns the display name shown in Obsidian UI
   * @returns Display name
   */
  getDisplayText(): string {
    return 'DashReader';
  }

  /**
   * Returns the icon identifier for this view
   * @returns Icon name
   */
  getIcon(): string {
    return 'zap';
  }

  /**
   * Called when the view is opened
   * Builds UI, sets up hotkeys, and registers auto-load
   */
  async onOpen(): Promise<void> {
    this.mainContainerEl = this.contentEl.createDiv({ cls: CSS_CLASSES.container });
    this.buildUI();
    this.setupHotkeys();

    // Setup auto-load when layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.setupAutoLoad();
    });
  }

  /**
   * Called when the view is closed
   * Stops reading and cleans up resources
   */
  async onClose(): Promise<void> {
    this.engine.stop();
    this.dom.clear();
  }

  // ============================================================================
  // SECTION 3: UI CONSTRUCTION
  // ============================================================================

  /**
   * Orchestrates the construction of all UI components
   * Called once during view initialization
   *
   * Order matters: toggle bar, breadcrumb, stats, display, progress, controls, settings
   */
  private buildUI(): void {
    this.buildToggleBar();
    this.buildBreadcrumb();
    this.buildStats();
    this.buildDisplayArea();
    this.buildProgressBar();
    this.buildControls();
    this.buildInlineSettings();
  }

  /**
   * Builds the toggle bar with settings and stats buttons
   * Located at the top of the view
   */
  private buildToggleBar(): void {
    this.toggleBar = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.toggleBar });

    createButton(this.toggleBar, {
      icon: ICONS.settings,
      title: 'Toggle controls (C)',
      onClick: () => this.togglePanel('controls'),
      className: CSS_CLASSES.toggleBtn,
    });

    createButton(this.toggleBar, {
      icon: ICONS.stats,
      title: 'Toggle stats (S)',
      onClick: () => this.togglePanel('stats'),
      className: CSS_CLASSES.toggleBtn,
    });

    createButton(this.toggleBar, {
      icon: ICONS.expand,
      title: 'Open in new tab',
      onClick: () => this.openInNewTab(),
      className: CSS_CLASSES.toggleBtn,
    });
  }

  /**
   * Builds the breadcrumb navigation bar
   * Shows the hierarchical position in the document (H1 > H2 > H3 etc.)
   * Updated automatically as reading progresses through headings
   */
  private buildBreadcrumb(): void {
    this.breadcrumbEl = this.mainContainerEl.createDiv({
      cls: 'dashreader-breadcrumb'
    });
    // Initially empty, will be populated by updateBreadcrumb()
    this.breadcrumbEl.style.display = 'none'; // Hidden until we have content
  }

  /**
   * Builds the statistics display panel
   * Shows WPM, words read, time elapsed, etc.
   */
  private buildStats(): void {
    this.statsEl = this.mainContainerEl.createDiv({
      cls: `${CSS_CLASSES.stats} ${CSS_CLASSES.hidden}`,
    });
    this.dom.register('statsEl', this.statsEl);

    const wpmDisplay = this.statsEl.createDiv({ cls: CSS_CLASSES.wpmDisplay });
    wpmDisplay.setText(`${this.settings.wpm} WPM`);
    this.dom.register('wpmDisplay', wpmDisplay);

    const statsText = this.statsEl.createDiv({ cls: CSS_CLASSES.statsText });
    statsText.setText('Ready');
    this.dom.register('statsText', statsText);
  }

  /**
   * Builds the main display area for word presentation
   * Includes context before/after if enabled
   */
  private buildDisplayArea(): void {
    const displayArea = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.display });

    // Context before (optional)
    if (this.settings.showContext) {
      this.contextBeforeEl = displayArea.createDiv({ cls: CSS_CLASSES.contextBefore });
      this.dom.register('contextBeforeEl', this.contextBeforeEl);
    }

    // Main word display
    this.wordEl = displayArea.createDiv({ cls: CSS_CLASSES.word });
    this.wordEl.style.fontSize = `${this.settings.fontSize}px`;
    this.wordEl.style.fontFamily = this.settings.fontFamily;
    this.wordEl.style.color = this.settings.fontColor;
    this.wordEl.innerHTML = createWelcomeMessage();
    this.dom.register('wordEl', this.wordEl);

    // Context after (optional)
    if (this.settings.showContext) {
      this.contextAfterEl = displayArea.createDiv({ cls: CSS_CLASSES.contextAfter });
      this.dom.register('contextAfterEl', this.contextAfterEl);
    }
  }

  /**
   * Builds the progress bar at the bottom of display
   * Updates during reading to show progress
   */
  private buildProgressBar(): void {
    this.progressEl = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.progressContainer });
    const progressBar = this.progressEl.createDiv({ cls: CSS_CLASSES.progressBar });
    progressBar.style.width = '0%';
    progressBar.style.background = this.settings.highlightColor;
    this.dom.register('progressBar', progressBar);
  }

  /**
   * Builds the playback controls panel
   * Includes play/pause, rewind, forward, stop, WPM, and chunk size controls
   */
  private buildControls(): void {
    this.controlsEl = this.mainContainerEl.createDiv({
      cls: `${CSS_CLASSES.controls} ${CSS_CLASSES.hidden}`,
    });
    this.dom.register('controlsEl', this.controlsEl);

    // Play controls group
    const playControls = this.controlsEl.createDiv({ cls: CSS_CLASSES.controlGroup });

    createButton(playControls, {
      icon: ICONS.rewind,
      title: 'Rewind (←)',
      onClick: () => this.engine.rewind(),
    });

    createPlayPauseButtons(playControls, () => this.togglePlay(), () => this.engine.pause(), this.dom);

    createButton(playControls, {
      icon: ICONS.forward,
      title: 'Forward (→)',
      onClick: () => this.engine.forward(),
    });

    createButton(playControls, {
      icon: ICONS.stop,
      title: 'Stop (Esc)',
      onClick: () => this.engine.reset(),
    });

    // WPM control
    createNumberControl(
      this.controlsEl,
      {
        label: 'WPM: ',
        value: this.settings.wpm,
        onIncrement: () => this.changeValue('wpm', INCREMENTS.wpm),
        onDecrement: () => this.changeValue('wpm', -INCREMENTS.wpm),
        increment: INCREMENTS.wpm,
        registryKey: 'wpmValue',
      },
      this.dom
    );

    // Chunk size control
    createNumberControl(
      this.controlsEl,
      {
        label: 'Words: ',
        value: this.settings.chunkSize,
        onIncrement: () => this.changeValue('chunkSize', INCREMENTS.chunkSize),
        onDecrement: () => this.changeValue('chunkSize', -INCREMENTS.chunkSize),
        registryKey: 'chunkValue',
      },
      this.dom
    );
  }

  /**
   * Builds the inline settings panel
   * Allows quick adjustments to WPM, acceleration, font size, etc.
   */
  private buildInlineSettings(): void {
    this.settingsEl = this.mainContainerEl.createDiv({
      cls: `${CSS_CLASSES.settings} ${CSS_CLASSES.hidden}`,
    });
    this.dom.register('settingsEl', this.settingsEl);

    // WPM control (duplicate for inline settings)
    createNumberControl(
      this.settingsEl,
      {
        label: 'Speed (WPM): ',
        value: this.settings.wpm,
        onIncrement: () => this.changeValue('wpm', INCREMENTS.wpm),
        onDecrement: () => this.changeValue('wpm', -INCREMENTS.wpm),
        increment: INCREMENTS.wpm,
        registryKey: 'wpmInlineValue',
        decrementTitle: 'Slower (-25)',
        incrementTitle: 'Faster (+25)',
      },
      this.dom
    );

    // Slow Start toggle (replaces Speed Acceleration)
    createToggleControl(this.settingsEl, {
      label: 'Slow Start',
      checked: this.settings.enableSlowStart,
      onChange: (checked) => {
        this.settings.enableSlowStart = checked;
        this.engine.updateSettings(this.settings);
      },
    });

    // Font size control
    createNumberControl(
      this.settingsEl,
      {
        label: 'Font Size: ',
        value: this.settings.fontSize,
        onIncrement: () => this.changeValue('fontSize', INCREMENTS.fontSize),
        onDecrement: () => this.changeValue('fontSize', -INCREMENTS.fontSize),
        registryKey: 'fontValue',
        decrementTitle: 'Smaller',
        incrementTitle: 'Larger',
      },
      this.dom
    );

    // Show context toggle
    createToggleControl(this.settingsEl, {
      label: 'Show context',
      checked: this.settings.showContext,
      onChange: (checked) => {
        this.settings.showContext = checked;
        this.toggleContextDisplay();
      },
    });

    // Micropause toggle
    createToggleControl(this.settingsEl, {
      label: 'Micropause',
      checked: this.settings.enableMicropause,
      onChange: (checked) => {
        this.settings.enableMicropause = checked;
        this.engine.updateSettings(this.settings);
      },
    });
  }

  // ============================================================================
  // SECTION 4: USER INTERACTIONS
  // ============================================================================

  /**
   * Unified value change handler
   * Replaces 5 separate change functions (changeWpm, changeWpmInline, etc.)
   *
   * @param type - Type of value to change
   * @param delta - Amount to change (positive or negative)
   */
  private changeValue(
    type: 'wpm' | 'chunkSize' | 'fontSize',
    delta: number
  ): void {
    switch (type) {
      case 'wpm': {
        const newWpm = this.engine.getWpm() + delta;
        this.engine.setWpm(newWpm);
        this.settings.wpm = this.engine.getWpm();
        this.state.set('currentWpm', this.settings.wpm);

        // Update all WPM displays (3 locations)
        this.dom.updateMultipleText({
          wpmDisplay: `${this.settings.wpm} WPM`,
          wpmValue: String(this.settings.wpm),
          wpmInlineValue: String(this.settings.wpm),
        });
        break;
      }

      case 'chunkSize': {
        const newSize = this.engine.getChunkSize() + delta;
        this.engine.setChunkSize(newSize);
        this.settings.chunkSize = this.engine.getChunkSize();
        this.state.set('currentChunkSize', this.settings.chunkSize);
        this.dom.updateText('chunkValue', this.settings.chunkSize);
        break;
      }

      case 'fontSize': {
        const newSize = Math.max(
          LIMITS.fontSize.min,
          Math.min(LIMITS.fontSize.max, this.settings.fontSize + delta)
        );
        this.settings.fontSize = newSize;
        this.state.set('currentFontSize', newSize);
        this.wordEl.style.fontSize = `${newSize}px`;
        this.dom.updateText('fontValue', newSize);
        break;
      }
    }
  }

  /**
   * Unified panel toggle handler
   * Replaces 3 separate toggle functions (toggleControls, toggleStats, etc.)
   *
   * @param panel - Panel to toggle ('controls' or 'stats')
   */
  private togglePanel(panel: 'controls' | 'stats'): void {
    if (panel === 'controls') {
      this.state.toggle('showingControls');
      const showing = this.state.get('showingControls');
      this.controlsEl.toggleClass(CSS_CLASSES.hidden, !showing);
      this.settingsEl.toggleClass(CSS_CLASSES.hidden, !showing);
    } else if (panel === 'stats') {
      this.state.toggle('showingStats');
      const showing = this.state.get('showingStats');
      this.statsEl.toggleClass(CSS_CLASSES.hidden, !showing);
    }
  }

  /**
   * Toggles the visibility of context before/after current word
   */
  private toggleContextDisplay(): void {
    const display = this.settings.showContext ? 'block' : 'none';
    if (this.contextBeforeEl) {
      this.contextBeforeEl.style.display = display;
    }
    if (this.contextAfterEl) {
      this.contextAfterEl.style.display = display;
    }
  }

  /**
   * Opens DashReader in a new tab (fullscreen-like experience)
   * Creates a new leaf/tab and transfers the current reading session to it
   */
  private async openInNewTab(): Promise<void> {
    const { workspace } = this.app;

    // Create a new tab
    const newLeaf = workspace.getLeaf('tab');

    if (newLeaf) {
      // Open DashReader view in the new tab
      await newLeaf.setViewState({
        type: VIEW_TYPE_DASHREADER,
        active: true,
      });

      // Reveal the new tab
      workspace.revealLeaf(newLeaf);
    }
  }

  // ============================================================================
  // SECTION 5: AUTO-LOAD SYSTEM
  // ============================================================================

  /**
   * Sets up automatic text loading from editor
   *
   * Registers event handlers for:
   * - file-open: Load text when opening a file
   * - active-leaf-change: Load text when switching files
   * - mouseup: Check for selection/cursor changes
   * - keyup: Check for navigation/selection keys
   *
   * Actual tracking logic is encapsulated in AutoLoadManager
   */
  private setupAutoLoad(): void {
    // Event: file-open - Auto-load entire page
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (!file) return;

        this.autoLoadManager.resetForNewFile(file.path);
        console.log('DashReader: File opened:', file.path);
        this.autoLoadManager.loadFromEditor(TIMING.autoLoadDelay);
      })
    );

    // Event: active-leaf-change - Backup loader
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        if (!this.mainContainerEl || !this.mainContainerEl.isShown()) return;

        console.log('DashReader: Active leaf changed');

        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile && this.autoLoadManager.hasFileChanged(currentFile.path)) {
          this.autoLoadManager.resetForNewFile(currentFile.path);
          this.autoLoadManager.loadFromEditor(TIMING.autoLoadDelayShort);
        }
      })
    );

    // Mouse events for cursor tracking
    this.registerDomEvent(document, 'mouseup', () => {
      console.log('DashReader: Mouse click detected');
      setTimeout(() => {
        if (this.mainContainerEl.isShown()) {
          this.autoLoadManager.checkSelectionOrCursor();
        }
      }, TIMING.autoLoadDelayVeryShort);
    });

    // Keyboard events for navigation and selection
    this.registerDomEvent(document, 'keyup', (evt: KeyboardEvent) => {
      if (isNavigationKey(evt) || isSelectionKey(evt)) {
        console.log('DashReader: Navigation key detected:', evt.key, 'with modifiers:', {
          shift: evt.shiftKey,
          ctrl: evt.ctrlKey,
          meta: evt.metaKey
        });
        setTimeout(() => {
          if (this.mainContainerEl.isShown()) {
            this.autoLoadManager.checkSelectionOrCursor();
          }
        }, TIMING.autoLoadDelayVeryShort);
      }
    });

    console.log('DashReader: Auto-load setup complete');
  }

  // ============================================================================
  // SECTION 6: HOTKEYS & KEYBOARD
  // ============================================================================

  /**
   * Sets up keyboard shortcuts for playback control
   */
  private setupHotkeys(): void {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  /**
   * Handles keyboard shortcuts
   *
   * Shortcuts:
   * - C: Toggle controls (when not playing)
   * - S: Toggle stats (when not playing)
   * - Shift+Space: Play/Pause
   * - Arrow keys: Rewind/Forward, WPM adjustment
   * - Escape: Stop reading
   *
   * @param e - Keyboard event
   */
  private handleKeyPress(e: KeyboardEvent): void {
    if (!this.mainContainerEl.isShown()) return;

    // Quick toggles (when not playing)
    if (e.key === 'c' && !this.engine.getIsPlaying()) {
      e.preventDefault();
      this.togglePanel('controls');
      return;
    }

    if (e.key === 's' && !this.engine.getIsPlaying()) {
      e.preventDefault();
      this.togglePanel('stats');
      return;
    }

    const keyCode = e.code || e.key;

    // Play/Pause with Shift+Space only
    if (keyCode === 'Space' && e.shiftKey) {
      e.preventDefault();
      console.log('DashReader: Shift+Space pressed, toggling play');
      this.togglePlay();
      return;
    }

    // Other hotkeys
    switch (keyCode) {
      case this.settings.hotkeyRewind:
        e.preventDefault();
        this.engine.rewind();
        break;
      case this.settings.hotkeyForward:
        e.preventDefault();
        this.engine.forward();
        break;
      case this.settings.hotkeyIncrementWpm:
        e.preventDefault();
        this.changeValue('wpm', INCREMENTS.wpm);
        break;
      case this.settings.hotkeyDecrementWpm:
        e.preventDefault();
        this.changeValue('wpm', -INCREMENTS.wpm);
        break;
      case this.settings.hotkeyQuit:
        e.preventDefault();
        this.engine.stop();
        break;
    }
  }

  /**
   * Toggles play/pause state
   * Updates UI buttons accordingly
   */
  private togglePlay(): void {
    if (this.engine.getIsPlaying()) {
      this.engine.pause();
      updatePlayPauseButtons(this.dom, false);
    } else {
      if (this.state.get('startTime') === 0) {
        this.state.set('startTime', Date.now());
      }
      this.engine.play();
      updatePlayPauseButtons(this.dom, true);
    }
  }

  // ============================================================================
  // SECTION 7: READING ENGINE CALLBACKS
  // ============================================================================

  /**
   * Called by engine when a new word is displayed
   * Updates the UI with the current word, context, progress, and stats
   *
   * @param chunk - Word chunk with text, index, delay info
   */
  private onWordChange(chunk: WordChunk): void {
    // Detect heading markers [H1], [H2], etc.
    const headingMatch = chunk.text.match(/^\[H(\d)\]/);
    // Detect callout markers [CALLOUT:type]
    const calloutMatch = chunk.text.match(/^\[CALLOUT:([\w-]+)\]/);

    let displayText = chunk.text;
    let headingLevel = 0;
    let showSeparator = false;
    let calloutType: string | undefined;

    if (headingMatch) {
      headingLevel = parseInt(headingMatch[1]);
      displayText = chunk.text.replace(/^\[H\d\]/, '');
      showSeparator = true;
      console.log('DashReader: Heading detected - Level', headingLevel, 'Text:', displayText);
    } else if (calloutMatch) {
      calloutType = calloutMatch[1];
      displayText = chunk.text.replace(/^\[CALLOUT:[\w-]+\]/, '');
      showSeparator = true;
      console.log('DashReader: Callout detected - Type', calloutType, 'Text:', displayText);
    }

    this.displayWordWithHeading(displayText, headingLevel, showSeparator, calloutType);

    // Update breadcrumb navigation
    if (chunk.headingContext) {
      this.updateBreadcrumb(chunk.headingContext);
    }

    // Update context
    if (this.settings.showContext && this.contextBeforeEl && this.contextAfterEl) {
      const context = this.engine.getContext(this.settings.contextWords);
      this.contextBeforeEl.setText(context.before.join(' '));
      this.contextAfterEl.setText(context.after.join(' '));
    }

    // Update progress bar
    const progress = this.engine.getProgress();
    this.dom.updateStyle('progressBar', 'width', `${progress}%`);

    // Update stats
    this.state.increment('wordsRead');
    this.updateStats();
  }

  /**
   * Displays a word with heading or callout-based styling
   *
   * @param word - Word to display
   * @param headingLevel - Heading level (1-6) or 0 for normal text/callouts
   * @param showSeparator - Whether to show separator line before heading/callout
   * @param calloutType - Callout type (note, abstract, info, etc.) if this is a callout
   */
  private displayWordWithHeading(word: string, headingLevel: number, showSeparator: boolean = false, calloutType?: string): void {
    // Callout icon mapping
    const calloutIcons: Record<string, string> = {
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

    // Calculate font size based on heading level or callout
    let fontSizeMultiplier = 1.0;
    let fontWeight = 'normal';
    let prefix = '';

    if (calloutType) {
      // Callouts: slightly larger font, with icon prefix
      fontSizeMultiplier = 1.2;
      fontWeight = 'bold';
      const icon = calloutIcons[calloutType.toLowerCase()] || '📌';
      prefix = `<span style="margin-right: 8px; opacity: 0.8;">${icon}</span>`;
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
    const processedWord = this.processWord(word);

    const separator = showSeparator
      ? `<div style="width: 60%; height: 2px; background: var(--text-muted); opacity: 0.4; margin: 0 auto 20px auto;"></div>`
      : '';

    this.wordEl.innerHTML = `
      ${separator}
      <div style="font-size: ${adjustedFontSize}px; transition: font-size 0.3s ease; font-weight: ${fontWeight};">
        ${prefix}${processedWord}
      </div>
    `;
  }

  /**
   * Processes a word for display with center character highlighting
   * Escapes HTML to prevent XSS attacks
   *
   * @param word - Word to process
   * @returns HTML string with highlighted center character
   */
  private processWord(word: string): string {
    const cleanWord = word.trim();
    const center = Math.max(Math.floor(cleanWord.length / 2) - 1, 0);

    let result = '';
    for (let i = 0; i < cleanWord.length; i++) {
      const escapedChar = escapeHtml(cleanWord[i]);

      if (i === center) {
        result += `<span class="${CSS_CLASSES.highlight}" style="color: ${this.settings.highlightColor}">${escapedChar}</span>`;
      } else {
        result += escapedChar;
      }
    }

    return result;
  }

  /**
   * Updates the breadcrumb navigation bar with current heading context
   * Shows hierarchical path (H1 > H2 > H3) and makes it clickable for navigation
   *
   * @param context - Current heading context from engine
   */
  private updateBreadcrumb(context: HeadingContext): void {
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

    // === PROGRESS INDICATORS CONTAINER ===
    const progressContainer = this.breadcrumbEl.createDiv({
      cls: 'dashreader-breadcrumb-progress'
    });
    progressContainer.style.display = 'flex';
    progressContainer.style.alignItems = 'center';
    progressContainer.style.gap = '12px';
    progressContainer.style.fontSize = '12px';
    progressContainer.style.color = 'var(--text-muted)';
    progressContainer.style.fontWeight = 'bold';

    // Calculate section progress (based on H1 headings)
    const allHeadings = this.engine.getHeadings();
    const allH1s = allHeadings.filter(h => h.level === 1);
    const currentIndex = this.engine.getCurrentIndex();

    // Find current section (which H1 are we in?)
    let currentSectionIndex = 0;
    for (let i = 0; i < allH1s.length; i++) {
      if (allH1s[i].wordIndex <= currentIndex) {
        currentSectionIndex = i + 1;
      } else {
        break;
      }
    }

    // Get progress percentage
    const totalWords = this.engine.getTotalWords();
    const progressPercent = totalWords > 0 ? (currentIndex / totalWords) * 100 : 0;

    // Section counter (if we have H1s)
    if (allH1s.length > 0 && currentSectionIndex > 0) {
      const sectionCounter = progressContainer.createSpan({
        text: `Section ${currentSectionIndex}/${allH1s.length}`,
        cls: 'dashreader-section-counter'
      });
      sectionCounter.style.opacity = '0.8';
    }

    // === BREADCRUMB PATH CONTAINER ===
    const breadcrumbPath = this.breadcrumbEl.createDiv({
      cls: 'dashreader-breadcrumb-path'
    });
    breadcrumbPath.style.display = 'flex';
    breadcrumbPath.style.flexWrap = 'wrap';
    breadcrumbPath.style.gap = '4px';
    breadcrumbPath.style.alignItems = 'center';

    // Callout icon mapping (same as displayWordWithHeading)
    const calloutIcons: Record<string, string> = {
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

    // Build breadcrumb items
    context.breadcrumb.forEach((heading, index) => {
      // Add separator if not first item
      if (index > 0) {
        const separator = breadcrumbPath.createSpan({
          cls: 'dashreader-breadcrumb-separator',
          text: ' › '
        });
        separator.style.opacity = '0.5';
        separator.style.margin = '0 4px';
        separator.style.flexShrink = '0';
      }

      // Determine display text with icon for callouts
      let displayText = heading.text;
      if (heading.calloutType) {
        const icon = calloutIcons[heading.calloutType.toLowerCase()] || '📌';
        displayText = `${icon} ${heading.text}`;
      }

      // Create breadcrumb item container (text + dropdown button)
      const itemContainer = breadcrumbPath.createSpan({
        cls: 'dashreader-breadcrumb-item-container'
      });
      itemContainer.style.display = 'inline-flex';
      itemContainer.style.alignItems = 'center';
      itemContainer.style.gap = '4px';

      // Create breadcrumb item text
      const item = itemContainer.createSpan({
        cls: 'dashreader-breadcrumb-item',
        text: displayText
      });

      // Style the item - allow full text display with wrapping
      const isLast = index === context.breadcrumb.length - 1;
      item.style.cursor = 'pointer';
      item.style.opacity = isLast ? '1' : '0.7';
      item.style.fontWeight = isLast ? 'bold' : 'normal';
      item.style.whiteSpace = 'normal'; // Allow wrapping for long titles
      item.style.wordBreak = 'break-word';

      // Font size: larger for higher-level headings, medium for callouts
      if (heading.calloutType) {
        item.style.fontSize = '14px'; // Callouts: consistent size
      } else {
        item.style.fontSize = `${12 + (2 * (6 - heading.level))}px`; // Headings: size by level
      }

      // Add hover effect
      item.addEventListener('mouseenter', () => {
        item.style.opacity = '1';
        item.style.textDecoration = 'underline';
      });
      item.addEventListener('mouseleave', () => {
        item.style.opacity = isLast ? '1' : '0.7';
        item.style.textDecoration = 'none';
      });

      // Make it clickable to navigate
      item.addEventListener('click', () => {
        this.navigateToHeading(heading.wordIndex);
      });

      // Add dropdown button for navigation
      const dropdown = itemContainer.createSpan({
        cls: 'dashreader-breadcrumb-dropdown',
        text: '▼'
      });
      dropdown.style.cursor = 'pointer';
      dropdown.style.opacity = '0.4';
      dropdown.style.fontSize = '10px';
      dropdown.style.padding = '2px 4px';
      dropdown.style.borderRadius = '3px';
      dropdown.style.transition = 'all 0.2s';

      dropdown.addEventListener('mouseenter', () => {
        dropdown.style.opacity = '1';
        dropdown.style.backgroundColor = 'var(--background-modifier-hover)';
      });
      dropdown.addEventListener('mouseleave', () => {
        dropdown.style.opacity = '0.4';
        dropdown.style.backgroundColor = 'transparent';
      });

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHeadingMenu(heading, dropdown);
      });
    });
  }

  /**
   * Shows a dropdown menu with all headings of the same level for navigation
   * @param currentHeading - The heading that was clicked
   * @param anchorEl - The element to position the menu relative to
   */
  private showHeadingMenu(currentHeading: HeadingInfo, anchorEl: HTMLElement): void {
    // Get all headings of the same level
    const allHeadings = this.engine.getHeadings();
    const sameLevelHeadings = allHeadings.filter(h => h.level === currentHeading.level);

    if (sameLevelHeadings.length <= 1) {
      // No other headings of this level, nothing to navigate to
      return;
    }

    // Create menu
    const menu = this.contentEl.createDiv({
      cls: 'dashreader-heading-menu'
    });

    // Position it near the anchor element
    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '1000';
    menu.style.backgroundColor = 'var(--background-primary)';
    menu.style.border = '1px solid var(--background-modifier-border)';
    menu.style.borderRadius = '4px';
    menu.style.padding = '4px';
    menu.style.maxHeight = '300px';
    menu.style.overflowY = 'auto';
    menu.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    menu.style.minWidth = '200px';

    // Add menu items
    sameLevelHeadings.forEach((heading, index) => {
      const isCurrent = heading.wordIndex === currentHeading.wordIndex;

      const menuItem = menu.createDiv({
        cls: 'dashreader-heading-menu-item'
      });
      menuItem.style.padding = '6px 12px';
      menuItem.style.cursor = 'pointer';
      menuItem.style.fontSize = '13px';
      menuItem.style.borderRadius = '3px';
      menuItem.style.display = 'flex';
      menuItem.style.alignItems = 'center';
      menuItem.style.gap = '8px';

      if (isCurrent) {
        menuItem.style.backgroundColor = 'var(--background-modifier-hover)';
        menuItem.style.fontWeight = 'bold';
      }

      // Add number
      const number = menuItem.createSpan({
        text: `${index + 1}.`
      });
      number.style.opacity = '0.6';
      number.style.minWidth = '25px';

      // Add heading text
      const text = menuItem.createSpan({
        text: heading.text
      });
      text.style.flex = '1';

      // Hover effect
      if (!isCurrent) {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = 'transparent';
        });
      }

      // Click to navigate
      menuItem.addEventListener('click', () => {
        this.navigateToHeading(heading.wordIndex);
        menu.remove();
      });
    });

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };

    // Delay adding the listener to avoid immediate close from the current click
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 10);
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
   * Called by engine when reading is complete
   * Updates UI to show completion message
   */
  private onComplete(): void {
    updatePlayPauseButtons(this.dom, false);
    this.dom.updateText('statsText', `Completed! ${ICONS.celebration}`);
  }

  /**
   * Updates the stats display with current reading statistics
   * Shows: words read, elapsed time, current WPM, remaining time
   */
  private updateStats(): void {
    const elapsed = this.engine.getElapsedTime();
    const currentWpm = this.engine.getCurrentWpmPublic();
    const remaining = this.engine.getRemainingTime();
    const wordsRead = this.state.get('wordsRead');

    this.dom.updateText(
      'statsText',
      `${wordsRead}/${this.engine.getTotalWords()} words | ${formatTime(elapsed)} | ${currentWpm} WPM | ${formatTime(remaining)} left`
    );
  }

  // ============================================================================
  // SECTION 8: TEXT LOADING
  // ============================================================================

  /**
   * Loads text for reading
   *
   * Process:
   * 1. Stop current reading if playing
   * 2. Parse markdown to plain text
   * 3. Calculate word index from cursor position (if provided)
   * 4. Validate text length
   * 5. Load into engine
   * 6. Update UI with ready message
   * 7. Auto-start if enabled
   *
   * @param text - Text to load (raw markdown)
   * @param source - Optional source information (filename, line, cursor position)
   */
  public loadText(text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }): void {
    console.log('DashReader: loadText called with source:', source);

    // Stop current reading if playing
    if (this.engine.getIsPlaying()) {
      this.engine.stop();
      updatePlayPauseButtons(this.dom, false);
      console.log('DashReader: Stopped current reading');
    }

    // Parse markdown FIRST (remove syntax, keep content)
    console.log('DashReader: Parsing markdown, original length:', text.length);
    const plainText = MarkdownParser.parseToPlainText(text);
    console.log('DashReader: After parsing, length:', plainText.length);
    console.log('DashReader: First 100 chars:', plainText.substring(0, 100));

    // Calculate word index from cursor position
    let wordIndexFromCursor: number | undefined;
    if (source?.cursorPosition !== undefined) {
      console.log('DashReader: Cursor position detected:', source.cursorPosition);

      // Parse text up to cursor position
      const textUpToCursor = text.substring(0, source.cursorPosition);
      const parsedUpToCursor = MarkdownParser.parseToPlainText(textUpToCursor);

      // Count words in parsed text (not raw markdown)
      const wordsBeforeCursor = parsedUpToCursor.trim().split(/\s+/).filter(w => w.length > 0);
      wordIndexFromCursor = wordsBeforeCursor.length;

      console.log('DashReader: Original text up to cursor:', textUpToCursor.length, 'chars');
      console.log('DashReader: Parsed text up to cursor:', parsedUpToCursor.length, 'chars');
      console.log('DashReader: Words before cursor (after parsing):', wordsBeforeCursor.slice(0, 10), '...');
      console.log('DashReader: Cursor at character', source.cursorPosition, '→ word index', wordIndexFromCursor, '(in parsed text)');
    } else {
      console.log('DashReader: No cursor position provided');
    }

    // Verify text length
    if (!plainText || plainText.trim().length < TEXT_LIMITS.minParsedLength) {
      console.log('DashReader: Text too short after parsing');
      return;
    }

    // Load text into engine
    this.engine.setText(plainText, undefined, wordIndexFromCursor);
    this.state.update({ wordsRead: 0, startTime: 0 });

    // Remove welcome message
    const welcomeMsg = this.wordEl.querySelector(`.${CSS_CLASSES.welcome}`);
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    this.wordEl.empty();

    // Prepare source info for display
    let sourceInfo = '';
    if (source?.fileName) {
      const escapedFileName = escapeHtml(source.fileName);
      const lineInfo = source.lineNumber ? ` (line ${source.lineNumber})` : '';
      sourceInfo = `<div style="font-size: 14px; opacity: 0.6; margin-bottom: 8px;">
        ${ICONS.file} ${escapedFileName}${lineInfo}
      </div>`;
    }

    // Calculate stats
    const totalWords = this.engine.getTotalWords();
    const remainingWords = this.engine.getRemainingWords();
    const estimatedDuration = this.engine.getEstimatedDuration();
    const durationText = formatTime(estimatedDuration);

    // Update stats display
    const fileInfo = source?.fileName ? ` from ${source.fileName}` : '';
    const wordInfo = wordIndexFromCursor && wordIndexFromCursor > 0
      ? `${remainingWords}/${totalWords} words`
      : `${totalWords} words`;
    this.dom.updateText('statsText', `${wordInfo} loaded${fileInfo} - ~${durationText} - Shift+Space to start`);

    // Display ready message
    this.wordEl.innerHTML = createReadyMessage(remainingWords, totalWords, wordIndexFromCursor, durationText, sourceInfo);

    console.log('DashReader: Words to read:', remainingWords, 'out of', totalWords);

    // Display initial breadcrumb (before starting reading)
    const allHeadings = this.engine.getHeadings();
    if (allHeadings.length > 0) {
      // Get the initial heading context based on starting position
      const startIndex = wordIndexFromCursor ?? 0;
      const relevantHeadings = allHeadings.filter(h => h.wordIndex <= startIndex);

      if (relevantHeadings.length > 0) {
        // Build hierarchical breadcrumb
        const breadcrumb: HeadingInfo[] = [];
        let currentLevel = 0;

        for (const heading of relevantHeadings) {
          if (heading.level <= currentLevel) {
            while (breadcrumb.length > 0 && breadcrumb[breadcrumb.length - 1].level >= heading.level) {
              breadcrumb.pop();
            }
          }
          breadcrumb.push(heading);
          currentLevel = heading.level;
        }

        const initialContext: HeadingContext = {
          breadcrumb,
          current: breadcrumb[breadcrumb.length - 1] || null
        };

        this.updateBreadcrumb(initialContext);
      }
    }

    // Auto-start if enabled
    if (this.settings.autoStart) {
      setTimeout(() => {
        this.engine.play();
        updatePlayPauseButtons(this.dom, true);
        this.state.set('startTime', Date.now());
      }, this.settings.autoStartDelay * 1000);
    }
  }

  // ============================================================================
  // SECTION 9: SETTINGS & LIFECYCLE
  // ============================================================================

  /**
   * Updates settings from plugin settings tab
   * Called when user changes settings in main settings panel
   *
   * @param settings - New settings
   */
  public updateSettings(settings: DashReaderSettings): void {
    this.settings = settings;
    this.engine.updateSettings(settings);

    if (this.wordEl) {
      this.wordEl.style.fontSize = `${settings.fontSize}px`;
      this.wordEl.style.fontFamily = settings.fontFamily;
      this.wordEl.style.color = settings.fontColor;
    }

    this.dom.updateText('wpmDisplay', `${settings.wpm} WPM`);
  }
}
