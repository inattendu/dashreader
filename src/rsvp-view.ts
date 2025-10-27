import { ItemView, WorkspaceLeaf, MarkdownView, Menu, Editor } from 'obsidian';
import { RSVPEngine } from './rsvp-engine';
import { DashReaderSettings, WordChunk } from './types';
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

export class DashReaderView extends ItemView {
  private engine: RSVPEngine;
  private settings: DashReaderSettings;
  private state: ViewState;
  private dom: DOMRegistry;
  private autoLoadManager: AutoLoadManager;

  // Main container elements (created once, stored for lifecycle)
  private mainContainerEl: HTMLElement;
  private toggleBar: HTMLElement;
  private wordEl: HTMLElement;
  private contextBeforeEl: HTMLElement;
  private contextAfterEl: HTMLElement;
  private controlsEl: HTMLElement;
  private settingsEl: HTMLElement;
  private progressEl: HTMLElement;
  private statsEl: HTMLElement;

  // Conditional group elements (need direct reference for show/hide)
  private accelDurationGroup: HTMLElement;
  private accelTargetGroup: HTMLElement;

  constructor(leaf: WorkspaceLeaf, settings: DashReaderSettings) {
    super(leaf);
    this.settings = settings;
    this.state = new ViewState({
      currentWpm: settings.wpm,
      currentChunkSize: settings.chunkSize,
      currentFontSize: settings.fontSize,
    });
    this.dom = new DOMRegistry();
    this.engine = new RSVPEngine(
      settings,
      this.onWordChange.bind(this),
      this.onComplete.bind(this)
    );
    this.autoLoadManager = new AutoLoadManager(
      this.app,
      this.loadText.bind(this),
      () => this.mainContainerEl?.isShown() ?? false
    );
  }

  getViewType(): string {
    return VIEW_TYPE_DASHREADER;
  }

  getDisplayText(): string {
    return 'DashReader';
  }

  getIcon(): string {
    return 'zap';
  }

  async onOpen(): Promise<void> {
    this.mainContainerEl = this.contentEl.createDiv({ cls: CSS_CLASSES.container });
    this.buildUI();
    this.setupHotkeys();

    // Setup auto-load when layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.setupAutoLoad();
    });
  }

  private buildUI(): void {
    this.buildToggleBar();
    this.buildStats();
    this.buildDisplayArea();
    this.buildProgressBar();
    this.buildControls();
    this.buildInlineSettings();
  }

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
  }

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

  private buildDisplayArea(): void {
    const displayArea = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.display });

    // Context before
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

    // Context after
    if (this.settings.showContext) {
      this.contextAfterEl = displayArea.createDiv({ cls: CSS_CLASSES.contextAfter });
      this.dom.register('contextAfterEl', this.contextAfterEl);
    }
  }

  private buildProgressBar(): void {
    this.progressEl = this.mainContainerEl.createDiv({ cls: CSS_CLASSES.progressContainer });
    const progressBar = this.progressEl.createDiv({ cls: CSS_CLASSES.progressBar });
    progressBar.style.width = '0%';
    progressBar.style.background = this.settings.highlightColor;
    this.dom.register('progressBar', progressBar);
  }

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

  private buildInlineSettings(): void {
    this.settingsEl = this.mainContainerEl.createDiv({
      cls: `${CSS_CLASSES.settings} ${CSS_CLASSES.hidden}`,
    });
    this.dom.register('settingsEl', this.settingsEl);

    // WPM control
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

    // Acceleration toggle
    const accelToggle = createToggleControl(this.settingsEl, {
      label: 'Speed Acceleration',
      checked: this.settings.enableAcceleration,
      onChange: (checked) => {
        this.settings.enableAcceleration = checked;
        this.engine.updateSettings(this.settings);
        this.accelDurationGroup.style.display = checked ? 'flex' : 'none';
        this.accelTargetGroup.style.display = checked ? 'flex' : 'none';
      },
    });

    // Acceleration duration
    const accelDurationControl = createNumberControl(
      this.settingsEl,
      {
        label: 'Accel Duration (s): ',
        value: this.settings.accelerationDuration,
        onIncrement: () => this.changeValue('accelDuration', INCREMENTS.accelDuration),
        onDecrement: () => this.changeValue('accelDuration', -INCREMENTS.accelDuration),
        registryKey: 'accelDurationValue',
        decrementTitle: 'Shorter (-5s)',
        incrementTitle: 'Longer (+5s)',
      },
      this.dom
    );
    this.accelDurationGroup = accelDurationControl.container;
    this.accelDurationGroup.style.display = this.settings.enableAcceleration ? 'flex' : 'none';

    // Acceleration target WPM
    const accelTargetControl = createNumberControl(
      this.settingsEl,
      {
        label: 'Target WPM: ',
        value: this.settings.accelerationTargetWpm,
        onIncrement: () => this.changeValue('accelTarget', INCREMENTS.wpm),
        onDecrement: () => this.changeValue('accelTarget', -INCREMENTS.wpm),
        registryKey: 'accelTargetValue',
        decrementTitle: 'Lower (-25)',
        incrementTitle: 'Higher (+25)',
      },
      this.dom
    );
    this.accelTargetGroup = accelTargetControl.container;
    this.accelTargetGroup.style.display = this.settings.enableAcceleration ? 'flex' : 'none';

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

  /**
   * Unified value change handler - replaces all changeWpm*, changeFontSize, etc.
   */
  private changeValue(
    type: 'wpm' | 'chunkSize' | 'fontSize' | 'accelDuration' | 'accelTarget',
    delta: number
  ): void {
    switch (type) {
      case 'wpm': {
        const newWpm = this.engine.getWpm() + delta;
        this.engine.setWpm(newWpm);
        this.settings.wpm = this.engine.getWpm();
        this.state.set('currentWpm', this.settings.wpm);

        // Update all WPM displays
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

      case 'accelDuration': {
        const newDuration = Math.max(
          LIMITS.accelDuration.min,
          Math.min(LIMITS.accelDuration.max, this.settings.accelerationDuration + delta)
        );
        this.settings.accelerationDuration = newDuration;
        this.engine.updateSettings(this.settings);
        this.dom.updateText('accelDurationValue', newDuration);
        break;
      }

      case 'accelTarget': {
        const newTarget = Math.max(
          LIMITS.wpm.min,
          Math.min(LIMITS.wpm.max, this.settings.accelerationTargetWpm + delta)
        );
        this.settings.accelerationTargetWpm = newTarget;
        this.engine.updateSettings(this.settings);
        this.dom.updateText('accelTargetValue', newTarget);
        break;
      }
    }
  }

  /**
   * Unified panel toggle - replaces toggleControls, toggleStats, toggleSettings
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
   * Setup automatic text loading from editor
   * Extracted into AutoLoadManager for better maintainability
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

  private setupHotkeys(): void {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

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

  private onWordChange(chunk: WordChunk): void {
    // Detect heading markers [H1], [H2], etc.
    const headingMatch = chunk.text.match(/^\[H(\d)\]/);
    let displayText = chunk.text;
    let headingLevel = 0;
    let showSeparator = false;

    if (headingMatch) {
      headingLevel = parseInt(headingMatch[1]);
      displayText = chunk.text.replace(/^\[H\d\]/, '');
      showSeparator = true;
      console.log('DashReader: Heading detected - Level', headingLevel, 'Text:', displayText);
    }

    this.displayWordWithHeading(displayText, headingLevel, showSeparator);

    // Update context
    if (this.settings.showContext && this.contextBeforeEl && this.contextAfterEl) {
      const context = this.engine.getContext(this.settings.contextWords);
      this.contextBeforeEl.setText(context.before.join(' '));
      this.contextAfterEl.setText(context.after.join(' '));
    }

    // Update progress
    const progress = this.engine.getProgress();
    this.dom.updateStyle('progressBar', 'width', `${progress}%`);

    // Update stats
    this.state.increment('wordsRead');
    this.updateStats();
  }

  private displayWordWithHeading(word: string, headingLevel: number, showSeparator: boolean = false): void {
    // Calculate font size based on heading level
    let fontSizeMultiplier = 1.0;
    if (headingLevel > 0) {
      const multipliers = [0, HEADING_MULTIPLIERS.h1, HEADING_MULTIPLIERS.h2, HEADING_MULTIPLIERS.h3, HEADING_MULTIPLIERS.h4, HEADING_MULTIPLIERS.h5, HEADING_MULTIPLIERS.h6];
      fontSizeMultiplier = multipliers[headingLevel] || 1.0;
    }

    const adjustedFontSize = this.settings.fontSize * fontSizeMultiplier;
    const processedWord = this.processWord(word);

    const separator = showSeparator
      ? `<div style="width: 60%; height: 2px; background: var(--text-muted); opacity: 0.4; margin: 0 auto 20px auto;"></div>`
      : '';

    this.wordEl.innerHTML = `
      ${separator}
      <div style="font-size: ${adjustedFontSize}px; transition: font-size 0.3s ease; font-weight: ${headingLevel > 0 ? 'bold' : 'normal'};">
        ${processedWord}
      </div>
    `;
  }

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

  private onComplete(): void {
    updatePlayPauseButtons(this.dom, false);
    this.dom.updateText('statsText', `Completed! ${ICONS.celebration}`);
  }

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

  public loadText(text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }): void {
    console.log('DashReader: loadText called with source:', source);

    // Stop current reading if playing
    if (this.engine.getIsPlaying()) {
      this.engine.stop();
      updatePlayPauseButtons(this.dom, false);
      console.log('DashReader: Stopped current reading');
    }

    // Parse markdown FIRST
    console.log('DashReader: Parsing markdown, original length:', text.length);
    const plainText = MarkdownParser.parseToPlainText(text);
    console.log('DashReader: After parsing, length:', plainText.length);
    console.log('DashReader: First 100 chars:', plainText.substring(0, 100));

    // Calculate word index from cursor position
    let wordIndexFromCursor: number | undefined;
    if (source?.cursorPosition !== undefined) {
      console.log('DashReader: Cursor position detected:', source.cursorPosition);

      const textUpToCursor = text.substring(0, source.cursorPosition);
      const parsedUpToCursor = MarkdownParser.parseToPlainText(textUpToCursor);

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

    // Prepare source info
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

    // Auto-start if enabled
    if (this.settings.autoStart) {
      setTimeout(() => {
        this.engine.play();
        updatePlayPauseButtons(this.dom, true);
        this.state.set('startTime', Date.now());
      }, this.settings.autoStartDelay * 1000);
    }
  }

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

  async onClose(): Promise<void> {
    this.engine.stop();
    this.dom.clear();
  }
}
