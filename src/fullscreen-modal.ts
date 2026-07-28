/**
 * @file fullscreen-modal.ts
 * @description Fullscreen modal for immersive RSVP reading experience
 *
 * This modal provides a distraction-free fullscreen reading mode with:
 * - Backdrop blur effect
 * - Shared engine state with sidebar view
 * - Keyboard controls (Space, Escape, arrows)
 * - Progress bar and stats
 *
 * @version 2.1.0
 * @author DashReader Team
 */

import { App, Modal, setIcon } from 'obsidian';
import { RSVPEngine } from './rsvp-engine';
import { DashReaderSettings, WordChunk } from './types';
import { WordDisplay } from './word-display';
import { BreadcrumbManager } from './breadcrumb-manager';
import { HotkeyHandler } from './hotkey-handler';
import { MinimapManager } from './minimap-manager';
import { TimeoutManager } from './services/timeout-manager';
import { StatsFormatter } from './services/stats-formatter';
import { DOMRegistry } from './dom-registry';
import {
  createButton,
  createToggleControl,
  createNumberControl,
} from './ui-builders';
import { CSS_CLASSES, ICONS } from './constants';

/**
 * Callback type for when the modal closes
 */
export type OnModalCloseCallback = () => void;

/**
 * FullscreenModal - Immersive fullscreen reading experience
 *
 * Opens a modal with backdrop blur that shares the reading engine
 * with the sidebar view. When closed, control returns to the sidebar.
 */
export class FullscreenModal extends Modal {
  // Core dependencies
  private engine: RSVPEngine;
  private settings: DashReaderSettings;
  private onModalClose: OnModalCloseCallback;
  private timeoutManager: TimeoutManager;

  // Managers
  private wordDisplay: WordDisplay;
  private breadcrumbManager: BreadcrumbManager;
  private hotkeyHandler: HotkeyHandler;
  private minimapManager: MinimapManager;
  private statsFormatter: StatsFormatter;
  private dom: DOMRegistry;

  // State
  private wasPlayingOnOpen: boolean;
  private originalOnWordChange: ((chunk: WordChunk) => void) | null = null;
  private originalOnComplete: (() => void) | null = null;

  // DOM elements
  private wordEl: HTMLElement;
  private breadcrumbEl: HTMLElement;
  private minimapContainer: HTMLElement;
  private statsEl: HTMLElement;
  private statsLeftEl: HTMLElement;
  private statsRightEl: HTMLElement;
  private controlsEl: HTMLElement;
  private displayArea: HTMLElement;

  constructor(
    app: App,
    engine: RSVPEngine,
    settings: DashReaderSettings,
    onModalClose: OnModalCloseCallback,
    timeoutManager: TimeoutManager
  ) {
    super(app);
    this.engine = engine;
    this.settings = settings;
    this.onModalClose = onModalClose;
    this.timeoutManager = timeoutManager;
    this.wasPlayingOnOpen = engine.getIsPlaying();

    // Initialize services
    this.statsFormatter = new StatsFormatter();
    this.dom = new DOMRegistry();
  }

  onOpen(): void {
    // Store original callbacks
    this.originalOnWordChange = this.engine.getOnWordChangeCallback();
    this.originalOnComplete = this.engine.getOnCompleteCallback();

    // Apply fullscreen modal styles
    this.modalEl.addClass('dashreader-fullscreen-modal');
    this.containerEl.addClass('dashreader-fullscreen-backdrop');

    // Build the UI
    this.buildFullscreenUI();

    // Initialize managers after UI is built
    this.wordDisplay = new WordDisplay(this.wordEl, this.settings, this.displayArea);
    // Use larger font for fullscreen: 2x effective size, shrinking will adjust if needed
    const fullscreenFontSize = this.engine.getEffectiveFontSize() * 2;
    this.wordDisplay.setBaseFontSize(fullscreenFontSize);
    this.breadcrumbManager = new BreadcrumbManager(
      this.breadcrumbEl,
      this.engine,
      this.timeoutManager
    );
    this.hotkeyHandler = new HotkeyHandler(this.settings, {
      onTogglePlay: () => this.togglePlay(),
      onRewind: () => this.engine.rewind(),
      onForward: () => this.engine.forward(),
      onIncrementWpm: () => this.changeWpm(10),
      onDecrementWpm: () => this.changeWpm(-10),
      onQuit: () => this.close(),
    });

    // Redirect engine callbacks to this modal
    this.engine.setCallbacks(
      this.onWordChange.bind(this),
      this.onComplete.bind(this)
    );

    // Setup keyboard events
    this.setupKeyboardEvents();

    // Setup wheel/trackpad navigation
    this.setupWheelNavigation();

    // Display current state
    this.displayCurrentState();

    // Build initial breadcrumb
    const currentIndex = this.engine.getCurrentIndex();
    const context = this.engine.getCurrentHeadingContext(currentIndex);
    if (context.breadcrumb.length > 0) {
      this.breadcrumbManager.updateBreadcrumb(context);
    }

    // Resume playing if was playing when modal opened
    if (this.wasPlayingOnOpen && !this.engine.getIsPlaying()) {
      this.engine.play();
    }

    // Start stats timer if playing
    if (this.engine.getIsPlaying()) {
      this.startStatsTimer();
    }

    // Always sync icon with final engine state at end of initialization
    this.updatePlayPauseIcon();
  }

  onClose(): void {
    // Clear scroll resume timer
    if (this.scrollResumeTimerId) {
      clearTimeout(this.scrollResumeTimerId);
      this.scrollResumeTimerId = null;
    }

    // Stop stats timer
    this.stopStatsTimer();

    // Pause if playing
    if (this.engine.getIsPlaying()) {
      this.engine.pause();
    }

    // Restore original callbacks
    if (this.originalOnWordChange || this.originalOnComplete) {
      this.engine.setCallbacks(
        this.originalOnWordChange ?? (() => {}),
        this.originalOnComplete ?? (() => {})
      );
    }

    // Clean up minimap
    if (this.minimapManager) {
      this.minimapManager.destroy();
    }

    // Clean up DOM registry
    this.dom.clear();

    // Notify parent
    this.onModalClose();
  }

  /**
   * Builds the fullscreen UI layout
   */
  private buildFullscreenUI(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dashreader-fullscreen-content');

    // Settings button (top right, next to Obsidian's close button)
    const settingsBtn = contentEl.createDiv({ cls: 'dashreader-fullscreen-settings-btn' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.setAttribute('aria-label', 'Settings');
    settingsBtn.addEventListener('click', () => this.toggleSettingsPanel());

    // Breadcrumb
    this.breadcrumbEl = contentEl.createDiv({
      cls: 'dashreader-breadcrumb dashreader-fullscreen-breadcrumb',
    });

    // Main display area
    this.displayArea = contentEl.createDiv({ cls: 'dashreader-fullscreen-display' });

    // Word display - use effective font size (respects mobile profile) * 2 for fullscreen
    // Note: WordDisplay constructor creates the focus bars overlay internally
    this.wordEl = this.displayArea.createDiv({ cls: 'dashreader-fullscreen-word' });
    const fullscreenInitFontSize = this.engine.getEffectiveFontSize() * 2;
    this.wordEl.style.fontSize = `${fullscreenInitFontSize}px`;
    this.wordEl.style.fontFamily = this.settings.fontFamily;
    this.wordEl.style.color = this.settings.fontColor;
    this.dom.register('wordEl', this.wordEl);

    // Apply focus bars class if enabled (on wordEl, not displayArea)
    if (this.settings.showFocusBars) {
      this.wordEl.addClass('dashreader-focus-enabled');
    }

    // Stats row with words (left) and time (right)
    this.statsEl = contentEl.createDiv({ cls: 'dashreader-fullscreen-stats-row' });
    this.statsLeftEl = this.statsEl.createDiv({ cls: 'dashreader-fullscreen-stats-left' });
    this.statsRightEl = this.statsEl.createDiv({ cls: 'dashreader-fullscreen-stats-right' });
    this.dom.register('statsLeftEl', this.statsLeftEl);
    this.dom.register('statsRightEl', this.statsRightEl);

    // Horizontal minimap with scrubbing (click to navigate when paused)
    this.minimapContainer = contentEl.createDiv({
      cls: 'dashreader-fullscreen-minimap-container',
    });
    this.minimapManager = new MinimapManager(
      this.minimapContainer,
      this.engine,
      this.timeoutManager,
      'horizontal'
    );
    this.minimapManager.render();
    this.setupMinimapInteraction();

    // Controls
    this.controlsEl = contentEl.createDiv({ cls: 'dashreader-fullscreen-controls' });
    this.buildControls();
  }

  /**
   * Builds playback controls and settings panel
   */
  private buildControls(): void {
    // Playback controls row - icon-based like fork
    const controlGroup = this.controlsEl.createDiv({ cls: CSS_CLASSES.controlGroup });

    // Previous heading (left arrow)
    createButton(controlGroup, {
      icon: ICONS.arrowLeft,
      title: 'Previous heading (←)',
      onClick: () => this.jumpHeading('up'),
      className: CSS_CLASSES.toggleBtn,
    });

    // Single play/pause button that changes icon
    const playPauseBtn = controlGroup.createEl('button', {
      cls: `${CSS_CLASSES.btn} ${CSS_CLASSES.toggleBtn}`,
      attr: {
        title: 'Play/Pause (Shift+Space)',
        'aria-label': 'Play/Pause',
        type: 'button'
      }
    });
    // Set initial icon based on current state
    setIcon(playPauseBtn, this.engine.getIsPlaying() ? 'pause' : 'play');
    playPauseBtn.addEventListener('click', () => this.togglePlay());
    this.dom.register('playPauseBtn', playPauseBtn);

    // Next heading (right arrow)
    createButton(controlGroup, {
      icon: ICONS.arrowRight,
      title: 'Next heading (→)',
      onClick: () => this.jumpHeading('down'),
      className: CSS_CLASSES.toggleBtn,
    });

    // Settings panel (hidden by default, toggled by top-right settings button)
    const settingsPanel = this.controlsEl.createDiv({
      cls: `dashreader-fullscreen-settings ${CSS_CLASSES.hidden}`
    });
    this.dom.register('settingsPanel', settingsPanel);

    // WPM control
    createNumberControl(
      settingsPanel,
      {
        label: 'WPM: ',
        value: this.engine.getWpm(),
        onIncrement: () => this.changeWpm(25),
        onDecrement: () => this.changeWpm(-25),
        registryKey: 'wpmValue',
        decrementTitle: 'Slower (-25)',
        incrementTitle: 'Faster (+25)',
      },
      this.dom
    );

    // Font size control
    createNumberControl(
      settingsPanel,
      {
        label: 'Font: ',
        value: Math.round(this.engine.getEffectiveFontSize() * 2),
        onIncrement: () => this.changeFontSize(4),
        onDecrement: () => this.changeFontSize(-4),
        registryKey: 'fontValue',
        decrementTitle: 'Smaller',
        incrementTitle: 'Larger',
      },
      this.dom
    );

    // Toggles row
    const togglesRow = settingsPanel.createDiv({ cls: 'dashreader-fullscreen-toggles' });

    // Slow start toggle
    createToggleControl(togglesRow, {
      label: 'Slow start',
      checked: this.settings.enableSlowStart,
      onChange: (checked) => {
        this.settings.enableSlowStart = checked;
        this.engine.updateSettings(this.settings);
      },
    });

    // Micropause toggle
    createToggleControl(togglesRow, {
      label: 'Micropause',
      checked: this.settings.enableMicropause,
      onChange: (checked) => {
        this.settings.enableMicropause = checked;
        this.engine.updateSettings(this.settings);
      },
    });

    // Focus bars toggle
    createToggleControl(togglesRow, {
      label: 'Focus bars',
      checked: this.settings.showFocusBars,
      onChange: (checked) => {
        this.settings.showFocusBars = checked;
        this.toggleFocusBarsDisplay();
      },
    });
  }

  /**
   * Toggles settings panel visibility
   */
  private toggleSettingsPanel(): void {
    const panel = this.dom.get('settingsPanel');
    if (panel) {
      panel.toggleClass(CSS_CLASSES.hidden, !panel.hasClass(CSS_CLASSES.hidden));
    }
  }

  /**
   * Changes font size by delta
   */
  private changeFontSize(delta: number): void {
    const currentSize = parseFloat(this.wordEl.style.fontSize) || this.engine.getEffectiveFontSize() * 2;
    const newSize = Math.max(24, Math.min(200, currentSize + delta));
    this.wordEl.style.fontSize = `${newSize}px`;
    this.dom.updateText('fontValue', String(Math.round(newSize)));
  }

  /**
   * Toggles focus bars visibility
   */
  private toggleFocusBarsDisplay(): void {
    this.wordEl.toggleClass('dashreader-focus-enabled', this.settings.showFocusBars);
  }

  /**
   * Sets up keyboard event handling
   */
  private setupKeyboardEvents(): void {
    this.contentEl.addEventListener('keydown', (e: KeyboardEvent) => {
      // Escape closes the modal
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      // Ctrl+ArrowLeft - Jump to start
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.engine.goToIndex(0);
        this.updateAfterNavigation();
        return;
      }

      // Ctrl+ArrowRight - Jump to end
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        this.engine.goToIndex(this.engine.getTotalWords() - 1);
        this.updateAfterNavigation();
        return;
      }

      // ArrowUp or ArrowLeft - Previous heading
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.jumpHeading('up');
        return;
      }

      // ArrowDown or ArrowRight - Next heading
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.jumpHeading('down');
        return;
      }

      this.hotkeyHandler.handleKeyPress(e);
    });

    // Focus the content to receive keyboard events
    this.contentEl.setAttribute('tabindex', '0');
    this.contentEl.focus();
  }

  /**
   * Displays the current reading state
   */
  private displayCurrentState(): void {
    const currentIndex = this.engine.getCurrentIndex();
    const totalWords = this.engine.getTotalWords();

    if (currentIndex > 0 && currentIndex < totalWords) {
      // Get current word to display
      const words = this.engine.getWords();
      if (words[currentIndex]) {
        this.displayWord(words[currentIndex]);
      }
    } else {
      // Show ready message
      const remainingWords = this.engine.getRemainingWords();
      const durationText = this.statsFormatter.formatTime(
        this.engine.getEstimatedDuration()
      );
      this.wordDisplay.displayReadyMessage(
        remainingWords,
        totalWords,
        currentIndex > 0 ? currentIndex : undefined,
        durationText
      );
    }

    this.updateProgress();
    this.updateStats();
  }

  /**
   * Engine callback: word changed
   */
  private onWordChange(chunk: WordChunk): void {
    this.displayWord(chunk.text);

    // Update breadcrumb
    if (chunk.headingContext && this.breadcrumbManager) {
      if (this.breadcrumbManager.hasHeadingContextChanged(chunk.headingContext)) {
        this.breadcrumbManager.updateBreadcrumb(chunk.headingContext);
      }
    }

    this.updateProgress();
    this.updateStats();
  }

  /**
   * Displays a word with heading/callout detection
   */
  private displayWord(text: string): void {
    const headingMatch = text.match(/^\[H(\d)\]/);
    const calloutMatch = text.match(/^\[CALLOUT:([\w-]+)\]/);

    let displayText = text;
    let headingLevel = 0;
    let showSeparator = false;
    let calloutType: string | undefined;

    if (headingMatch) {
      headingLevel = parseInt(headingMatch[1]);
      displayText = text.replace(/^\[H\d\]/, '');
      showSeparator = true;
    } else if (calloutMatch) {
      calloutType = calloutMatch[1];
      displayText = text.replace(/^\[CALLOUT:[\w-]+\]/, '');
      showSeparator = true;
    }

    this.wordDisplay.displayWord(displayText, headingLevel, showSeparator, calloutType);
  }

  /**
   * Engine callback: reading complete
   */
  private onComplete(): void {
    this.updatePlayPauseIcon();
    this.statsEl.setText('Reading complete! 🎉');
  }

  /**
   * Updates the minimap position
   */
  private updateProgress(): void {
    const currentIndex = this.engine.getCurrentIndex();
    this.minimapManager.updateCurrentPosition(currentIndex);
  }

  /**
   * Updates the stats display with split layout (words left, time right)
   */
  private updateStats(): void {
    const currentIndex = this.engine.getCurrentIndex();
    const totalWords = this.engine.getTotalWords();

    // Left: word count
    this.statsLeftEl.setText(`${currentIndex}/${totalWords}`);

    // Right: remaining time (always estimated from current position)
    // This recalculates correctly after scroll/navigation
    const remainingTime = this.engine.getRemainingTime();
    const remainingText = this.statsFormatter.formatTime(remainingTime);
    this.statsRightEl.setText(remainingText);
  }

  /**
   * Sets up click/drag interaction on the minimap for scrubbing when paused
   */
  private setupMinimapInteraction(): void {
    let isDragging = false;

    const seekToPosition = (e: MouseEvent) => {
      const rect = this.minimapContainer.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const ratio = x / rect.width;
      const targetIndex = Math.floor(ratio * this.engine.getTotalWords());

      // Navigate to position (updateAfterNavigation handles pause avoidance & heading snap)
      this.engine.goToIndex(targetIndex);
      this.updateAfterNavigation();
    };

    this.minimapContainer.addEventListener('mousedown', (e) => {
      // Only allow scrubbing when paused
      if (this.engine.getIsPlaying()) return;

      isDragging = true;
      seekToPosition(e);
      this.minimapContainer.addClass('scrubbing');
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      seekToPosition(e);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.minimapContainer.removeClass('scrubbing');
      }
    });

    // Click without drag
    this.minimapContainer.addEventListener('click', (e) => {
      if (this.engine.getIsPlaying()) return;
      seekToPosition(e);
    });

    // Wheel navigation on minimap
    let wheelAccum = 0;
    let wheelDir = 0;
    let wasPlayingBeforeScroll = false;
    const WHEEL_THRESHOLD = 80;

    this.minimapContainer.addEventListener('wheel', (e: WheelEvent) => {
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
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          this.updatePlayPauseIcon();
        }
        this.engine.forward(1);
        this.updateAfterNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
      // Backward (scroll up)
      else if (wheelAccum <= -WHEEL_THRESHOLD) {
        wheelAccum += WHEEL_THRESHOLD;
        wheelAccum = Math.max(wheelAccum, -(WHEEL_THRESHOLD - 1));
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          this.updatePlayPauseIcon();
        }
        this.engine.rewind(1);
        this.updateAfterNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
    }, { passive: false });
  }

  /**
   * Sets up wheel/trackpad navigation for word-by-word scrubbing
   * Based on fork implementation for smooth, responsive scrolling
   * Only works when paused
   */
  // Timer for resuming after scroll navigation
  private scrollResumeTimerId: ReturnType<typeof setTimeout> | null = null;
  private readonly SCROLL_RESUME_DELAY = 800; // ms before resuming after scroll

  // Timer for updating stats display every second during playback
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly STATS_UPDATE_INTERVAL = 1000; // ms between stats updates

  private setupWheelNavigation(): void {
    let wheelAccum = 0;
    let wheelDir = 0;
    let wasPlayingBeforeScroll = false;
    const WHEEL_THRESHOLD = 80;

    this.contentEl.addEventListener('wheel', (e: WheelEvent) => {
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
        // Cap to prevent multiple jumps
        wheelAccum = Math.min(wheelAccum, WHEEL_THRESHOLD - 1);
        // Pause if playing before navigating, track that we were playing
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          this.updatePlayPauseIcon();
        }
        this.engine.forward(1); // Move 1 word forward
        this.updateAfterNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
      // Backward (scroll up)
      else if (wheelAccum <= -WHEEL_THRESHOLD) {
        wheelAccum += WHEEL_THRESHOLD;
        // Cap to prevent multiple jumps
        wheelAccum = Math.max(wheelAccum, -(WHEEL_THRESHOLD - 1));
        // Pause if playing before navigating, track that we were playing
        if (this.engine.getIsPlaying()) {
          wasPlayingBeforeScroll = true;
          this.engine.pause();
          this.updatePlayPauseIcon();
        }
        this.engine.rewind(1); // Move 1 word backward
        this.updateAfterNavigation();
        this.scheduleResumeAfterScroll(wasPlayingBeforeScroll, () => { wasPlayingBeforeScroll = false; });
      }
    }, { passive: false, capture: true });
  }

  /**
   * Updates display after navigation
   * Adjusts position to avoid pauses (line breaks)
   */
  private updateAfterNavigation(): void {
    let currentIndex = this.engine.getCurrentIndex();
    const words = this.engine.getWords();

    // Adjust index to avoid landing on pause words ('\n')
    currentIndex = this.adjustIndexToAvoidPause(currentIndex, words);

    // Apply adjusted index if changed
    if (currentIndex !== this.engine.getCurrentIndex()) {
      this.engine.goToIndex(currentIndex);
    }

    // Update progress and stats
    this.updateProgress();
    this.updateStats();

    // Display the word at the new position
    if (words[currentIndex]) {
      this.displayWord(words[currentIndex]);
    }

    // Update breadcrumb
    const context = this.engine.getCurrentHeadingContext(currentIndex);
    if (context.breadcrumb.length > 0 && this.breadcrumbManager) {
      this.breadcrumbManager.updateBreadcrumb(context);
    }
  }

  /**
   * Adjusts index to avoid landing on pause words ('\n')
   * Moves forward to next non-pause word
   */
  private adjustIndexToAvoidPause(index: number, words: string[]): number {
    const maxIndex = words.length - 1;
    let adjusted = index;

    // Skip forward past any pause words
    while (adjusted < maxIndex && words[adjusted] === '\n') {
      adjusted++;
    }

    // If we hit the end, try going backward
    if (adjusted >= maxIndex && words[adjusted] === '\n') {
      adjusted = index;
      while (adjusted > 0 && words[adjusted] === '\n') {
        adjusted--;
      }
    }

    return adjusted;
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
      this.startStatsTimer();
      this.updatePlayPauseIcon();
    }, this.SCROLL_RESUME_DELAY);
  }

  /**
   * Starts the stats update timer for linear time display during playback
   */
  private startStatsTimer(): void {
    // Don't start if already running
    if (this.statsIntervalId) return;

    this.statsIntervalId = setInterval(() => {
      // Only update if still playing
      if (this.engine.getIsPlaying()) {
        this.updateStats();
      } else {
        // Stop timer if playback stopped
        this.stopStatsTimer();
      }
    }, this.STATS_UPDATE_INTERVAL);
  }

  /**
   * Stops the stats update timer
   */
  private stopStatsTimer(): void {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
  }

  /**
   * Toggles play/pause state
   */
  private togglePlay(): void {
    const btn = this.dom.get('playPauseBtn');
    if (this.engine.getIsPlaying()) {
      this.engine.pause();
      this.stopStatsTimer();
      // Set icon directly based on action taken (now paused -> show play)
      if (btn) setIcon(btn, 'play');
    } else {
      this.engine.play();
      this.startStatsTimer();
      // Set icon directly based on action taken (now playing -> show pause)
      if (btn) setIcon(btn, 'pause');
    }
  }

  /**
   * Updates the play/pause button icon based on engine state
   * @param forceState - Optional: force icon to specific state ('play' or 'pause')
   */
  private updatePlayPauseIcon(forceState?: 'play' | 'pause'): void {
    const btn = this.dom.get('playPauseBtn');
    if (btn) {
      const icon = forceState ?? (this.engine.getIsPlaying() ? 'pause' : 'play');
      setIcon(btn, icon);
    }
  }

  /**
   * Changes WPM by delta
   */
  private changeWpm(delta: number): void {
    const newWpm = Math.max(50, Math.min(5000, this.engine.getWpm() + delta));
    this.engine.setWpm(newWpm);
    this.dom.updateText('wpmValue', String(newWpm));
    this.updateStats();
  }

  /**
   * Jumps to the previous or next heading
   * @param direction - 'up' for previous, 'down' for next
   */
  private jumpHeading(direction: 'up' | 'down'): void {
    const headings = this.engine.getHeadings();
    if (headings.length === 0) return;

    const currentIndex = this.engine.getCurrentIndex();
    let targetHeading;

    if (direction === 'up') {
      // Find the previous heading (before current position)
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].wordIndex < currentIndex) {
          targetHeading = headings[i];
          break;
        }
      }
      // If no previous heading found, go to start
      if (!targetHeading) {
        this.engine.goToIndex(0);
        this.updateAfterNavigation();
        return;
      }
    } else {
      // Find the next heading (after current position)
      for (const heading of headings) {
        if (heading.wordIndex > currentIndex) {
          targetHeading = heading;
          break;
        }
      }
      // If no next heading found, go to end
      if (!targetHeading) {
        this.engine.goToIndex(this.engine.getTotalWords() - 1);
        this.updateAfterNavigation();
        return;
      }
    }

    this.engine.goToIndex(targetHeading.wordIndex);
    this.updateAfterNavigation();
  }
}
