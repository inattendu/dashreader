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

import { ItemView, WorkspaceLeaf, Platform } from 'obsidian';
import { RSVPEngine } from './rsvp-engine';
import { DashReaderSettings, WordChunk } from './types';
import { MarkdownParser } from './markdown-parser';
import { ViewState } from './view-state';
import { DOMRegistry } from './dom-registry';
import { BreadcrumbManager } from './breadcrumb-manager';
import { WordDisplay } from './word-display';
import { HotkeyHandler } from './hotkey-handler';
import { MinimapManager } from './minimap-manager';
import { TimeoutManager } from './services/timeout-manager';
import { StatsFormatter } from './services/stats-formatter';
import { FullscreenModal } from './fullscreen-modal';
import {
  createButton,
  createNumberControl,
  createToggleControl,
  createPlayPauseButtons,
  updatePlayPauseButtons,
} from './ui-builders';
import {
  CSS_CLASSES,
  ICONS,
  TIMING,
  TEXT_LIMITS,
  INCREMENTS,
  LIMITS,
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

  /** Breadcrumb navigation manager */
  private breadcrumbManager: BreadcrumbManager;

  /** Word display manager */
  private wordDisplay: WordDisplay;

  /** Hotkey handler */
  private hotkeyHandler: HotkeyHandler;

  /** Minimap navigation manager */
  private minimapManager: MinimapManager;

  /** Timeout manager for preventing memory leaks */
  private timeoutManager: TimeoutManager;

  /** Statistics formatter for consistent stats display */
  private statsFormatter: StatsFormatter;

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

  /** Currently open fullscreen modal (null if none) */
  private fullscreenModal: FullscreenModal | null = null;

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

    // Initialize timeout manager for memory leak prevention
    this.timeoutManager = new TimeoutManager();

    // Initialize stats formatter for consistent statistics display
    this.statsFormatter = new StatsFormatter();

    // Initialize RSVP engine with callbacks
    this.engine = new RSVPEngine(
      settings,
      this.onWordChange.bind(this) as (chunk: WordChunk) => void,
      this.onComplete.bind(this) as () => void,
      this.timeoutManager
    );

    // Initialize auto-load manager for editor integration
    this.autoLoadManager = new AutoLoadManager(
      this.app,
      this.loadText.bind(this) as (text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }) => void,
      () => this.mainContainerEl?.isShown() ?? false,
      this.timeoutManager
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mobile Detection
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Detects if running on a mobile device (iOS/Android)
   * Uses Obsidian's Platform API with fallback to media query
   * @returns true if on mobile device
   */
  private isMobileUI(): boolean {
    // Try Obsidian's Platform API first
    if (Platform.isMobileApp || Platform.isMobile) {
      return true;
    }

    // Fallback: media query for touch devices without hover
    return window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false;
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
    return 'Speed reader';
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
    // Note: async required by Obsidian's ItemView interface
    await Promise.resolve();

    // Apply mobile profile if on mobile device
    const isMobile = this.isMobileUI();
    this.engine.setUseMobileProfile(isMobile);

    this.mainContainerEl = this.contentEl.createDiv({ cls: CSS_CLASSES.container });
    this.buildUI();

    // Initialize modules after UI is built
    this.breadcrumbManager = new BreadcrumbManager(this.breadcrumbEl, this.engine, this.timeoutManager);
    const displayArea = this.dom.get('displayArea');
    this.wordDisplay = new WordDisplay(this.wordEl, this.settings, displayArea || undefined);
    this.hotkeyHandler = new HotkeyHandler(this.settings, {
      onTogglePlay: () => this.togglePlay(),
      onRewind: () => this.engine.rewind(),
      onForward: () => this.engine.forward(),
      onIncrementWpm: () => this.changeValue('wpm', 10),
      onDecrementWpm: () => this.changeValue('wpm', -10),
      onQuit: () => this.engine.stop()
    });
    this.minimapManager = new MinimapManager(this.mainContainerEl, this.engine, this.timeoutManager);
    this.setupMinimapWheelNavigation();

    // Display welcome message now that wordDisplay is initialized
    this.wordDisplay.displayWelcomeMessage(
      ICONS.book,
      'Select text to start reading',
      'or use Cmd+P → "Read selected text"'
    );

    // Apply initial visibility settings
    this.toggleContextDisplay();
    this.toggleMinimapDisplay();
    this.toggleBreadcrumbDisplay();

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
    // Note: async required by Obsidian's ItemView interface
    await Promise.resolve();
    this.engine.stop();
    this.timeoutManager.clearAll();
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
      title: 'Fullscreen mode (F)',
      onClick: () => this.openFullscreen(),
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
      cls: `dashreader-breadcrumb ${CSS_CLASSES.hidden}`
    });
    // Initially empty, will be populated by updateBreadcrumb()
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
    this.dom.register('displayArea', displayArea);

    // Context before (optional)
    if (this.settings.showContext) {
      this.contextBeforeEl = displayArea.createDiv({ cls: CSS_CLASSES.contextBefore });
      this.dom.register('contextBeforeEl', this.contextBeforeEl);
    }

    // Main word display
    // Note: WordDisplay constructor creates the focus bars overlay internally
    this.wordEl = displayArea.createDiv({ cls: CSS_CLASSES.word });
    // Use effective font size (respects mobile profile)
    this.wordEl.style.fontSize = `${this.engine.getEffectiveFontSize()}px`;
    this.wordEl.style.fontFamily = this.settings.fontFamily;
    this.wordEl.style.color = this.settings.fontColor;
    this.dom.register('wordEl', this.wordEl);

    // Apply focus bars class if enabled (on wordEl, not displayArea)
    if (this.settings.showFocusBars) {
      this.wordEl.addClass('dashreader-focus-enabled');
    }

    // Context after (optional)
    if (this.settings.showContext) {
      this.contextAfterEl = displayArea.createDiv({ cls: CSS_CLASSES.contextAfter });
      this.dom.register('contextAfterEl', this.contextAfterEl);
    }

    // Setup wheel/trackpad navigation on display area
    this.setupWheelNavigation(displayArea);
  }

  /**
   * Sets up wheel/trackpad navigation for word-by-word scrubbing
   * Based on fork implementation for smooth, responsive scrolling
   * Only works when paused
   */
  private setupWheelNavigation(displayArea: HTMLElement): void {
    let wheelAccum = 0;
    let wheelDir = 0;
    let wasPlayingBeforeScroll = false;
    const WHEEL_THRESHOLD = 80;

    displayArea.addEventListener('wheel', (e: WheelEvent) => {
      // Skip if modifier keys pressed (allow zoom, etc.)
      if (e.ctrlKey || e.metaKey) return;

      // Skip if target is an interactive element
      const target = e.target as HTMLElement;
      if (target?.closest('button, a, input, textarea, select')) return;

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
        // Pause if playing before navigating, track that we were playing
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          updatePlayPauseButtons(this.dom, false);
        }
        this.engine.forward(1);
        this.updateAfterWheelNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
      // Backward (scroll up)
      else if (wheelAccum <= -WHEEL_THRESHOLD) {
        wheelAccum += WHEEL_THRESHOLD;
        wheelAccum = Math.max(wheelAccum, -(WHEEL_THRESHOLD - 1));
        // Pause if playing before navigating, track that we were playing
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          updatePlayPauseButtons(this.dom, false);
        }
        this.engine.rewind(1);
        this.updateAfterWheelNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
    }, { passive: false, capture: true });
  }

  /**
   * Updates display after wheel navigation
   */
  private updateAfterWheelNavigation(): void {
    const currentIndex = this.engine.getCurrentIndex();
    const words = this.engine.getWords();

    // Update minimap
    if (this.minimapManager) {
      this.minimapManager.updateCurrentPosition(currentIndex);
    }

    // Update progress bar
    const progress = this.engine.getProgress();
    this.dom.updateStyle('progressBar', 'width', `${progress}%`);

    // Update stats
    this.updateStats();

    // Display the word
    if (words[currentIndex]) {
      const word = words[currentIndex];
      const headingMatch = word.match(/^\[H(\d)\]/);
      const calloutMatch = word.match(/^\[CALLOUT:([\w-]+)\]/);

      let displayText = word;
      let headingLevel = 0;
      let calloutType: string | undefined;

      if (headingMatch) {
        headingLevel = parseInt(headingMatch[1]);
        displayText = word.replace(/^\[H\d\]/, '');
      } else if (calloutMatch) {
        calloutType = calloutMatch[1];
        displayText = word.replace(/^\[CALLOUT:[\w-]+\]/, '');
      }

      this.wordDisplay.displayWord(displayText, headingLevel, false, calloutType);

      // Update breadcrumb
      const context = this.engine.getCurrentHeadingContext(currentIndex);
      if (context.breadcrumb.length > 0 && this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumb(context);
      }
    }
  }

  // Timer for resuming after scroll navigation
  private scrollResumeTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly SCROLL_RESUME_DELAY = 800; // ms before resuming after scroll

  /**
   * Sets up wheel navigation on the minimap
   * Uses the same pause/resume logic as the main display area
   */
  private setupMinimapWheelNavigation(): void {
    let wasPlayingBeforeScroll = false;

    this.minimapManager.setupWheelNavigation(
      // On forward (scroll down)
      () => {
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          updatePlayPauseButtons(this.dom, false);
        }
        this.engine.forward(1);
        this.updateAfterWheelNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      },
      // On backward (scroll up)
      () => {
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          updatePlayPauseButtons(this.dom, false);
        }
        this.engine.rewind(1);
        this.updateAfterWheelNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
    );
  }

  /**
   * Schedules resuming playback after scroll navigation
   * Uses debounce - resets timer on each scroll
   */
  private scheduleResumeAfterScroll(wasPlaying: boolean, resetCallback: () => void): void {
    // Clear any existing timer
    if (this.scrollResumeTimerId) {
      clearTimeout(this.scrollResumeTimerId);
      this.scrollResumeTimerId = null;
    }

    // Only schedule resume if we were playing before
    if (!wasPlaying) return;

    this.scrollResumeTimerId = setTimeout(() => {
      this.scrollResumeTimerId = null;
      resetCallback();
      // Resume playback
      this.engine.play();
      updatePlayPauseButtons(this.dom, true);
    }, this.SCROLL_RESUME_DELAY);
  }

  /**
   * Builds the progress bar at the bottom of display
   * Updates during reading to show progress
   */
  private buildProgressBar(): void {
    this.progressEl = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.progressContainer });
    const progressBar = this.progressEl.createDiv({ cls: CSS_CLASSES.progressBar });
    // Set initial styles using setAttr for CSS properties
    progressBar.setAttr('style', `width: 0%; background: ${this.settings.highlightColor}`);
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

    // Minimap toggle
    createToggleControl(this.settingsEl, {
      label: 'Minimap',
      checked: this.settings.showMinimap,
      onChange: (checked) => {
        this.settings.showMinimap = checked;
        this.toggleMinimapDisplay();
      },
    });

    // Breadcrumb toggle
    createToggleControl(this.settingsEl, {
      label: 'Breadcrumb',
      checked: this.settings.showBreadcrumb,
      onChange: (checked) => {
        this.settings.showBreadcrumb = checked;
        this.toggleBreadcrumbDisplay();
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

    // Focus bars toggle (Reedy-style)
    createToggleControl(this.settingsEl, {
      label: 'Focus bars',
      checked: this.settings.showFocusBars,
      onChange: (checked) => {
        this.settings.showFocusBars = checked;
        this.toggleFocusBarsDisplay();
      },
    });
  }

  /**
   * Toggle focus bars visibility
   */
  private toggleFocusBarsDisplay(): void {
    const wordEl = this.dom.get('wordEl');
    if (wordEl) {
      wordEl.toggleClass('dashreader-focus-enabled', this.settings.showFocusBars);
    }
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
    const shouldHide = !this.settings.showContext;
    if (this.contextBeforeEl) {
      this.contextBeforeEl.toggleClass(CSS_CLASSES.hidden, shouldHide);
    }
    if (this.contextAfterEl) {
      this.contextAfterEl.toggleClass(CSS_CLASSES.hidden, shouldHide);
    }
  }

  /**
   * Toggle minimap visibility
   */
  private toggleMinimapDisplay(): void {
    if (this.minimapManager) {
      if (this.settings.showMinimap) {
        this.minimapManager.show();
      } else {
        this.minimapManager.hide();
      }
    }
  }

  /**
   * Toggle breadcrumb visibility
   * Uses effective setting (respects mobile profile)
   */
  private toggleBreadcrumbDisplay(): void {
    const shouldHide = !this.engine.getEffectiveShowBreadcrumb();
    if (this.breadcrumbEl) {
      this.breadcrumbEl.toggleClass(CSS_CLASSES.hidden, shouldHide);
    }
  }

  /**
   * Toggles fullscreen modal for immersive reading experience
   * If modal is open, closes it. Otherwise opens a new one.
   * Shares the current engine state with the modal.
   */
  private openFullscreen(): void {
    // If modal is already open, close it (toggle behavior)
    if (this.fullscreenModal) {
      this.fullscreenModal.close();
      return;
    }

    // Check if we have text loaded
    if (this.engine.getTotalWords() === 0) {
      return;
    }

    const modal = new FullscreenModal(
      this.app,
      this.engine,
      this.settings,
      () => {
        // Callback: modal closed, restore callbacks
        this.fullscreenModal = null;
        this.engine.setCallbacks(
          this.onWordChange.bind(this),
          this.onComplete.bind(this)
        );
        // Update UI to reflect current state
        updatePlayPauseButtons(this.dom, this.engine.getIsPlaying());
        // Refresh sidebar display to show current position
        this.refreshDisplayAfterFullscreen();
      },
      this.timeoutManager
    );

    this.fullscreenModal = modal;
    modal.open();
  }

  /**
   * Refreshes the sidebar display after returning from fullscreen
   * Shows the current word position and updates all UI elements
   */
  private refreshDisplayAfterFullscreen(): void {
    const currentIndex = this.engine.getCurrentIndex();
    const totalWords = this.engine.getTotalWords();
    const words = this.engine.getWords();

    // Update minimap position
    if (this.minimapManager) {
      this.minimapManager.updateCurrentPosition(currentIndex);
    }

    // Update progress bar
    const progress = this.engine.getProgress();
    this.dom.updateStyle('progressBar', 'width', `${progress}%`);

    // Update stats
    this.updateStats();

    // If we're at a valid position, display that word
    if (currentIndex > 0 && currentIndex < totalWords && words[currentIndex]) {
      const word = words[currentIndex];

      // Detect heading/callout markers
      const headingMatch = word.match(/^\[H(\d)\]/);
      const calloutMatch = word.match(/^\[CALLOUT:([\w-]+)\]/);

      let displayText = word;
      let headingLevel = 0;
      let showSeparator = false;
      let calloutType: string | undefined;

      if (headingMatch) {
        headingLevel = parseInt(headingMatch[1]);
        displayText = word.replace(/^\[H\d\]/, '');
        showSeparator = true;
      } else if (calloutMatch) {
        calloutType = calloutMatch[1];
        displayText = word.replace(/^\[CALLOUT:[\w-]+\]/, '');
        showSeparator = true;
      }

      this.wordDisplay.displayWord(displayText, headingLevel, showSeparator, calloutType);

      // Update breadcrumb
      const context = this.engine.getCurrentHeadingContext(currentIndex);
      if (context.breadcrumb.length > 0 && this.breadcrumbManager) {
        this.breadcrumbManager.updateBreadcrumb(context);
      }
    } else {
      // Show ready message at beginning
      const remainingWords = this.engine.getRemainingWords();
      const durationText = this.statsFormatter.formatTime(this.engine.getEstimatedDuration());
      this.wordDisplay.displayReadyMessage(
        remainingWords,
        totalWords,
        currentIndex > 0 ? currentIndex : undefined,
        durationText
      );
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
        this.autoLoadManager.loadFromEditor(TIMING.autoLoadDelay);
      })
    );

    // Event: active-leaf-change - Backup loader
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        if (!this.mainContainerEl || !this.mainContainerEl.isShown()) return;

        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile && this.autoLoadManager.hasFileChanged(currentFile.path)) {
          this.autoLoadManager.resetForNewFile(currentFile.path);
          this.autoLoadManager.loadFromEditor(TIMING.autoLoadDelayShort);
        }
      })
    );

    // Mouse events for cursor tracking
    this.registerDomEvent(document, 'mouseup', () => {
      this.timeoutManager.setTimeout(() => {
        if (this.mainContainerEl.isShown()) {
          this.autoLoadManager.checkSelectionOrCursor();
        }
      }, TIMING.autoLoadDelayVeryShort);
    });

    // Keyboard events for navigation and selection
    this.registerDomEvent(document, 'keyup', (evt: KeyboardEvent) => {
      if (isNavigationKey(evt) || isSelectionKey(evt)) {
        this.timeoutManager.setTimeout(() => {
          if (this.mainContainerEl.isShown()) {
            this.autoLoadManager.checkSelectionOrCursor();
          }
        }, TIMING.autoLoadDelayVeryShort);
      }
    });
  }

  // ============================================================================
  // SECTION 6: HOTKEYS & KEYBOARD
  // ============================================================================

  /**
   * Sets up keyboard shortcuts for playback control
   */
  private setupHotkeys(): void {
    document.addEventListener('keydown', this.handleKeyPress.bind(this) as (e: KeyboardEvent) => void);
  }

  /**
   * Handles keyboard shortcuts
   *
   * Shortcuts:
   * - C: Toggle controls (when not playing)
   * - S: Toggle stats (when not playing)
   * - F: Open fullscreen mode
   * - Shift+Space: Play/Pause
   * - Arrow keys: Rewind/Forward, WPM adjustment
   * - Escape: Stop reading
   *
   * @param e - Keyboard event
   */
  private handleKeyPress(e: KeyboardEvent): void {
    if (!this.mainContainerEl.isShown()) return;

    // Quick toggles for panels (when not playing)
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

    // Fullscreen mode
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      this.openFullscreen();
      return;
    }

    // Delegate hotkey handling to HotkeyHandler
    this.hotkeyHandler.handleKeyPress(e);
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
    } else if (calloutMatch) {
      calloutType = calloutMatch[1];
      displayText = chunk.text.replace(/^\[CALLOUT:[\w-]+\]/, '');
      showSeparator = true;
    }

    // Delegate word display to WordDisplay module
    this.wordDisplay.displayWord(displayText, headingLevel, showSeparator, calloutType);

    // Update breadcrumb navigation (only if context changed)
    if (chunk.headingContext && this.breadcrumbManager) {
      if (this.breadcrumbManager.hasHeadingContextChanged(chunk.headingContext)) {
        this.breadcrumbManager.updateBreadcrumb(chunk.headingContext);
      }
    }

    // Update minimap current position
    if (this.minimapManager) {
      this.minimapManager.updateCurrentPosition(chunk.index);
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
    const statsText = this.statsFormatter.formatReadingStats({
      wordsRead: this.state.get('wordsRead'),
      totalWords: this.engine.getTotalWords(),
      elapsedTime: this.engine.getElapsedTime(),
      currentWpm: this.engine.getCurrentWpmPublic(),
      remainingTime: this.engine.getRemainingTime()
    });

    this.dom.updateText('statsText', statsText);
  }

  // ============================================================================
  // SECTION 8: TEXT LOADING
  // ============================================================================

  /**
   * Parses markdown and calculates start position from cursor
   *
   * @param text - Raw markdown text
   * @param cursorPosition - Optional cursor position in raw text
   * @returns Object with plainText and wordIndex
   */
  private parseAndCalculateStartPosition(
    text: string,
    cursorPosition?: number
  ): { plainText: string; wordIndex?: number } {
    // Parse markdown FIRST (remove syntax, keep content)
    const plainText = MarkdownParser.parseToPlainText(text);

    // Calculate word index from cursor position
    let wordIndex: number | undefined;
    if (cursorPosition !== undefined) {
      // Parse text up to cursor position
      const textUpToCursor = text.substring(0, cursorPosition);
      const parsedUpToCursor = MarkdownParser.parseToPlainText(textUpToCursor);

      // Count words in parsed text (not raw markdown)
      const wordsBeforeCursor = parsedUpToCursor.trim().split(/\s+/).filter(w => w.length > 0);
      wordIndex = wordsBeforeCursor.length;
    }

    return { plainText, wordIndex };
  }

  /**
   * Updates stats display and word display with ready message
   *
   * @param wordIndex - Starting word index (if resuming from cursor)
   * @param source - Optional source information (filename, line number)
   */
  private updateStatsDisplay(
    wordIndex: number | undefined,
    source?: { fileName?: string; lineNumber?: number }
  ): void {
    // Format loaded stats using service
    const statsText = this.statsFormatter.formatLoadedStats({
      remainingWords: this.engine.getRemainingWords(),
      totalWords: this.engine.getTotalWords(),
      estimatedDuration: this.engine.getEstimatedDuration(),
      fileName: source?.fileName,
      startWordIndex: wordIndex
    });

    // Update stats text in footer
    this.dom.updateText('statsText', statsText);

    // Display ready message in main word area
    const durationText = this.statsFormatter.formatTime(this.engine.getEstimatedDuration());
    this.wordDisplay.displayReadyMessage(
      this.engine.getRemainingWords(),
      this.engine.getTotalWords(),
      wordIndex,
      durationText,
      source?.fileName,
      source?.lineNumber
    );
  }

  /**
   * Builds and displays initial breadcrumb based on starting position
   *
   * @param wordIndex - Starting word index (0 if starting from beginning)
   */
  private buildInitialBreadcrumb(wordIndex: number): void {
    // Get heading context from engine (reuses breadcrumb building logic)
    const context = this.engine.getCurrentHeadingContext(wordIndex);

    // Update breadcrumb manager if we have headings
    if (context.breadcrumb.length > 0) {
      this.breadcrumbManager.updateBreadcrumb(context);
    }
  }

  /**
   * Handles auto-start functionality if enabled in settings
   * Starts reading after the configured delay
   */
  private handleAutoStart(): void {
    if (!this.settings.autoStart) return;

    this.timeoutManager.setTimeout(() => {
      this.engine.play();
      updatePlayPauseButtons(this.dom, true);
      this.state.set('startTime', Date.now());
    }, this.settings.autoStartDelay * 1000);
  }

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
    // Stop current reading if playing
    if (this.engine.getIsPlaying()) {
      this.engine.stop();
      updatePlayPauseButtons(this.dom, false);
    }

    // Reset breadcrumb context for new text
    this.breadcrumbManager.reset();

    // Parse markdown and calculate start position
    const { plainText, wordIndex: wordIndexFromCursor } = this.parseAndCalculateStartPosition(
      text,
      source?.cursorPosition
    );

    // Verify text length
    if (!plainText || plainText.trim().length < TEXT_LIMITS.minParsedLength) {
      return;
    }

    // Load text into engine
    this.engine.setText(plainText, undefined, wordIndexFromCursor);
    this.state.update({ wordsRead: 0, startTime: 0 });

    // Note: Don't call wordEl.empty() here - WordDisplay manages its own content
    // via contentEl.empty() in displayReadyMessage()

    // Update stats and display ready message
    this.updateStatsDisplay(wordIndexFromCursor, source);

    // Build and display initial breadcrumb
    this.buildInitialBreadcrumb(wordIndexFromCursor ?? 0);

    // Render minimap with headings
    this.minimapManager.render();

    // Auto-start reading if enabled
    this.handleAutoStart();
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
      // Use effective font size (respects mobile profile)
      this.wordEl.style.fontSize = `${this.engine.getEffectiveFontSize()}px`;
      this.wordEl.style.fontFamily = settings.fontFamily;
      this.wordEl.style.color = settings.fontColor;
    }

    // Update focus bars visibility
    const wordEl = this.dom.get('wordEl');
    if (wordEl) {
      wordEl.toggleClass('dashreader-focus-enabled', settings.showFocusBars);
    }

    // Update breadcrumb visibility based on effective setting
    this.toggleBreadcrumbDisplay();

    this.dom.updateText('wpmDisplay', `${settings.wpm} WPM`);
  }
}
