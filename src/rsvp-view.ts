import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { RSVPEngine } from './rsvp-engine';
import { DashReaderSettings, WordChunk } from './types';
import { MarkdownParser } from './markdown-parser';

export const VIEW_TYPE_DASHREADER = 'dashreader-view';

export class DashReaderView extends ItemView {
  private engine: RSVPEngine;
  private settings: DashReaderSettings;
  private mainContainerEl: HTMLElement;
  private toggleBar: HTMLElement;
  private wordEl: HTMLElement;
  private contextBeforeEl: HTMLElement;
  private contextAfterEl: HTMLElement;
  private controlsEl: HTMLElement;
  private settingsEl: HTMLElement;
  private progressEl: HTMLElement;
  private statsEl: HTMLElement;
  private wpmDisplayEl: HTMLElement;
  private startTime: number = 0;
  private wordsRead: number = 0;
  private showingControls: boolean = false;
  private showingSettings: boolean = false;

  constructor(leaf: WorkspaceLeaf, settings: DashReaderSettings) {
    super(leaf);
    this.settings = settings;
    this.engine = new RSVPEngine(
      settings,
      this.onWordChange.bind(this),
      this.onComplete.bind(this)
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
    this.mainContainerEl = this.contentEl.createDiv({ cls: 'dashreader-container' });
    this.buildUI();
    this.setupHotkeys();

    // Attendre que le layout soit prêt avant de setup l'auto-load
    this.app.workspace.onLayoutReady(() => {
      this.setupAutoLoad();
    });
  }

  private buildUI(): void {
    // Barre de toggles discrète en haut
    this.toggleBar = this.mainContainerEl.createDiv({ cls: 'dashreader-toggle-bar' });

    const toggleControls = this.toggleBar.createEl('button', {
      cls: 'dashreader-toggle-btn',
      attr: { title: 'Toggle controls (C)' }
    });
    toggleControls.innerHTML = '⚙️';
    toggleControls.addEventListener('click', () => this.toggleControls());

    const toggleStats = this.toggleBar.createEl('button', {
      cls: 'dashreader-toggle-btn',
      attr: { title: 'Toggle stats (S)' }
    });
    toggleStats.innerHTML = '📊';
    toggleStats.addEventListener('click', () => this.toggleStats());

    // Stats (caché par défaut)
    this.statsEl = this.mainContainerEl.createDiv({ cls: 'dashreader-stats hidden' });
    this.wpmDisplayEl = this.statsEl.createDiv({ cls: 'dashreader-wpm-display' });
    this.wpmDisplayEl.setText(`${this.settings.wpm} WPM`);
    const statsText = this.statsEl.createDiv({ cls: 'dashreader-stats-text' });
    statsText.setText('Ready');

    // Zone d'affichage principale - DISTRACTION FREE
    const displayArea = this.mainContainerEl.createDiv({ cls: 'dashreader-display' });

    // Contexte avant
    if (this.settings.showContext) {
      this.contextBeforeEl = displayArea.createDiv({ cls: 'dashreader-context-before' });
    }

    // Mot principal - FOCUS
    this.wordEl = displayArea.createDiv({ cls: 'dashreader-word' });
    this.wordEl.style.fontSize = `${this.settings.fontSize}px`;
    this.wordEl.style.fontFamily = this.settings.fontFamily;
    this.wordEl.style.color = this.settings.fontColor;

    // Message d'accueil avec instructions
    const welcomeMsg = this.wordEl.createDiv({ cls: 'dashreader-welcome' });
    welcomeMsg.innerHTML = `
      <div style="font-size: 20px; color: var(--text-muted); text-align: center;">
        <div style="margin-bottom: 12px;">📖 Select text to start reading</div>
        <div style="font-size: 14px; opacity: 0.7;">or use Cmd+P → "Read selected text"</div>
      </div>
    `;

    // Contexte après
    if (this.settings.showContext) {
      this.contextAfterEl = displayArea.createDiv({ cls: 'dashreader-context-after' });
    }

    // Barre de progression (toujours visible mais discrète)
    this.progressEl = this.mainContainerEl.createDiv({ cls: 'dashreader-progress-container' });
    const progressBar = this.progressEl.createDiv({ cls: 'dashreader-progress-bar' });
    progressBar.style.width = '0%';
    progressBar.style.background = this.settings.highlightColor;

    // Contrôles (caché par défaut)
    this.controlsEl = this.mainContainerEl.createDiv({ cls: 'dashreader-controls hidden' });
    this.buildControls();

    // Settings inline (caché par défaut)
    this.settingsEl = this.mainContainerEl.createDiv({ cls: 'dashreader-settings hidden' });
    this.buildInlineSettings();
  }

  private buildControls(): void {
    // Groupe de contrôles de lecture
    const playControls = this.controlsEl.createDiv({ cls: 'dashreader-control-group' });

    this.createButton(playControls, '⏮', 'Rewind (←)', () => this.engine.rewind());
    this.createButton(playControls, '▶', 'Play (Shift+Space)', () => this.togglePlay(), 'play-btn');
    this.createButton(playControls, '⏸', 'Pause (Shift+Space)', () => this.engine.pause(), 'pause-btn hidden');
    this.createButton(playControls, '⏭', 'Forward (→)', () => this.engine.forward());
    this.createButton(playControls, '⏹', 'Stop (Esc)', () => this.engine.reset());

    // Groupe WPM
    const wpmGroup = this.controlsEl.createDiv({ cls: 'dashreader-control-group' });
    wpmGroup.createEl('span', { text: 'WPM: ', cls: 'control-label' });
    this.createButton(wpmGroup, '−', 'Decrease WPM (↓)', () => this.changeWpm(-25), 'small-btn');
    const wpmValue = wpmGroup.createEl('span', { text: String(this.settings.wpm), cls: 'wpm-value' });
    this.createButton(wpmGroup, '+', 'Increase WPM (↑)', () => this.changeWpm(25), 'small-btn');

    // Groupe Words
    const wordsGroup = this.controlsEl.createDiv({ cls: 'dashreader-control-group' });
    wordsGroup.createEl('span', { text: 'Words: ', cls: 'control-label' });
    this.createButton(wordsGroup, '−', 'Fewer words', () => this.changeChunkSize(-1), 'small-btn');
    const chunkValue = wordsGroup.createEl('span', { text: String(this.settings.chunkSize), cls: 'chunk-value' });
    this.createButton(wordsGroup, '+', 'More words', () => this.changeChunkSize(1), 'small-btn');
  }

  private buildInlineSettings(): void {
    // Quick inline settings

    // WPM (Reading speed)
    const wpmGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    wpmGroup.createEl('span', { text: 'Speed (WPM): ', cls: 'setting-label' });
    this.createButton(wpmGroup, '−', 'Slower (-25)', () => this.changeWpmInline(-25), 'small-btn');
    const wpmValue = wpmGroup.createEl('span', { text: String(this.settings.wpm), cls: 'wpm-inline-value' });
    this.createButton(wpmGroup, '+', 'Faster (+25)', () => this.changeWpmInline(25), 'small-btn');

    // Acceleration - Toggle
    const accelToggleGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    const accelToggle = accelToggleGroup.createEl('label', { cls: 'setting-toggle' });
    const accelCheckbox = accelToggle.createEl('input', { type: 'checkbox' });
    accelCheckbox.checked = this.settings.enableAcceleration;
    accelCheckbox.addEventListener('change', () => {
      this.settings.enableAcceleration = accelCheckbox.checked;
      this.engine.updateSettings(this.settings);
      // Show/hide acceleration controls
      accelDurationGroup.style.display = accelCheckbox.checked ? 'flex' : 'none';
      accelTargetGroup.style.display = accelCheckbox.checked ? 'flex' : 'none';
    });
    accelToggle.createEl('span', { text: ' Speed Acceleration' });

    // Acceleration - Duration
    const accelDurationGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    accelDurationGroup.createEl('span', { text: 'Accel Duration (s): ', cls: 'setting-label' });
    this.createButton(accelDurationGroup, '−', 'Shorter (-5s)', () => this.changeAccelDuration(-5), 'small-btn');
    const accelDurationValue = accelDurationGroup.createEl('span', { text: String(this.settings.accelerationDuration), cls: 'accel-duration-value' });
    this.createButton(accelDurationGroup, '+', 'Longer (+5s)', () => this.changeAccelDuration(5), 'small-btn');
    accelDurationGroup.style.display = this.settings.enableAcceleration ? 'flex' : 'none';

    // Acceleration - Target WPM
    const accelTargetGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    accelTargetGroup.createEl('span', { text: 'Target WPM: ', cls: 'setting-label' });
    this.createButton(accelTargetGroup, '−', 'Lower (-25)', () => this.changeAccelTarget(-25), 'small-btn');
    const accelTargetValue = accelTargetGroup.createEl('span', { text: String(this.settings.accelerationTargetWpm), cls: 'accel-target-value' });
    this.createButton(accelTargetGroup, '+', 'Higher (+25)', () => this.changeAccelTarget(25), 'small-btn');
    accelTargetGroup.style.display = this.settings.enableAcceleration ? 'flex' : 'none';

    // Font Size
    const fontSizeGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    fontSizeGroup.createEl('span', { text: 'Font Size: ', cls: 'setting-label' });
    this.createButton(fontSizeGroup, '−', 'Smaller', () => this.changeFontSize(-4), 'small-btn');
    const fontValue = fontSizeGroup.createEl('span', { text: String(this.settings.fontSize), cls: 'font-value' });
    this.createButton(fontSizeGroup, '+', 'Larger', () => this.changeFontSize(4), 'small-btn');

    // Toggle contexte
    const contextGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    const contextToggle = contextGroup.createEl('label', { cls: 'setting-toggle' });
    const contextCheckbox = contextToggle.createEl('input', { type: 'checkbox' });
    contextCheckbox.checked = this.settings.showContext;
    contextCheckbox.addEventListener('change', () => {
      this.settings.showContext = contextCheckbox.checked;
      this.toggleContextDisplay();
    });
    contextToggle.createEl('span', { text: ' Show context' });

    // Toggle micropause
    const micropauseGroup = this.settingsEl.createDiv({ cls: 'dashreader-setting-group' });
    const micropauseToggle = micropauseGroup.createEl('label', { cls: 'setting-toggle' });
    const micropauseCheckbox = micropauseToggle.createEl('input', { type: 'checkbox' });
    micropauseCheckbox.checked = this.settings.enableMicropause;
    micropauseCheckbox.addEventListener('change', () => {
      this.settings.enableMicropause = micropauseCheckbox.checked;
      this.engine.updateSettings(this.settings);
    });
    micropauseToggle.createEl('span', { text: ' Micropause' });
  }

  private createButton(
    parent: HTMLElement,
    text: string,
    title: string,
    onClick: () => void,
    className: string = ''
  ): HTMLButtonElement {
    const btn = parent.createEl('button', {
      text,
      cls: `dashreader-btn ${className}`,
      attr: { title }
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private toggleControls(): void {
    this.showingControls = !this.showingControls;
    this.controlsEl.toggleClass('hidden', !this.showingControls);
    this.settingsEl.toggleClass('hidden', !this.showingControls);
  }

  private toggleStats(): void {
    this.showingSettings = !this.showingSettings;
    this.statsEl.toggleClass('hidden', !this.showingSettings);
  }

  private toggleContextDisplay(): void {
    if (this.contextBeforeEl) {
      this.contextBeforeEl.style.display = this.settings.showContext ? 'block' : 'none';
    }
    if (this.contextAfterEl) {
      this.contextAfterEl.style.display = this.settings.showContext ? 'block' : 'none';
    }
  }

  private setupAutoLoad(): void {
    // Utiliser les événements Obsidian (comme Smart Connections)
    let lastSelection = '';
    let lastFilePath = '';
    let lastCursorPosition = -1;
    let lastCheckTime = 0;

    const checkSelectionOrCursor = () => {
      // Throttle: ne pas vérifier plus d'une fois toutes les 150ms
      const now = Date.now();
      if (now - lastCheckTime < 150) {
        return;
      }
      lastCheckTime = now;
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) return;

      const currentFile = this.app.workspace.getActiveFile();
      if (!currentFile) return;

      const fileName = currentFile.name;

      // Cas 1: Il y a une sélection
      if (activeView.editor.somethingSelected()) {
        const selection = activeView.editor.getSelection();
        if (selection && selection.length > 30 && selection !== lastSelection) {
          lastSelection = selection;
          const cursor = activeView.editor.getCursor('from');
          const lineNumber = cursor.line + 1;
          console.log('DashReader: Auto-loading selection', selection.length, 'characters from', fileName, 'line', lineNumber);
          this.loadText(selection, { fileName, lineNumber });
        }
      }
      // Cas 2: Pas de sélection - recharger depuis la position du curseur
      else {
        const fullContent = activeView.editor.getValue();
        if (fullContent && fullContent.trim().length > 50) {
          const cursor = activeView.editor.getCursor();
          const cursorPosition = activeView.editor.posToOffset(cursor);

          // Recharger si la position a changé
          if (cursorPosition !== lastCursorPosition) {
            const positionDiff = Math.abs(cursorPosition - lastCursorPosition);
            console.log('DashReader: Cursor moved from', lastCursorPosition, 'to', cursorPosition, '(diff:', positionDiff, ')');
            console.log('DashReader: Reloading from cursor position', cursorPosition, 'in', fileName);
            this.loadText(fullContent, { fileName, cursorPosition });
            lastSelection = ''; // Reset selection
            lastCursorPosition = cursorPosition;
          }
        }
      }
    };

    // ÉVÉNEMENT CLÉ: file-open - Charger automatiquement toute la page
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (!file) return;

        // Reset la sélection quand on change de fichier
        lastSelection = '';
        lastFilePath = file.path;
        lastCursorPosition = -1; // Reset cursor tracking
        console.log('DashReader: File opened:', file.path);

        // Charger automatiquement toute la page
        setTimeout(() => {
          if (!this.mainContainerEl.isShown()) return;

          const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            const fileName = file.name;

            // Vérifier d'abord s'il y a une sélection
            if (activeView.editor.somethingSelected()) {
              const selection = activeView.editor.getSelection();
              if (selection && selection.length > 30) {
                // Obtenir le numéro de ligne de la sélection
                const cursor = activeView.editor.getCursor('from');
                const lineNumber = cursor.line + 1;
                console.log('DashReader: Auto-loading selection', selection.length, 'characters from line', lineNumber);
                this.loadText(selection, { fileName, lineNumber });
                return;
              }
            }

            // Sinon, charger toute la page par défaut à partir de la position du curseur
            const fullContent = activeView.editor.getValue();
            if (fullContent && fullContent.trim().length > 50) {
              // Obtenir la position du curseur dans le texte brut
              const cursor = activeView.editor.getCursor();
              const cursorPosition = activeView.editor.posToOffset(cursor);
              console.log('DashReader: Auto-loading entire page from cursor position', cursorPosition);
              this.loadText(fullContent, { fileName, cursorPosition });
            }
          }
        }, 300);
      })
    );

    // active-leaf-change (backup) - Charger aussi toute la page ici
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        // Vérifier que la vue est visible
        if (!this.mainContainerEl || !this.mainContainerEl.isShown()) {
          return;
        }

        console.log('DashReader: Active leaf changed');

        // Si c'est une note Markdown
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          const currentFile = this.app.workspace.getActiveFile();
          if (currentFile && currentFile.path !== lastFilePath) {
            lastSelection = '';
            lastFilePath = currentFile.path;
            lastCursorPosition = -1; // Reset cursor tracking

            // Charger automatiquement après changement de leaf
            setTimeout(() => {
              if (!this.mainContainerEl.isShown()) return;

              const fileName = currentFile.name;

              // Vérifier d'abord s'il y a une sélection
              if (activeView.editor.somethingSelected()) {
                const selection = activeView.editor.getSelection();
                if (selection && selection.length > 30) {
                  const cursor = activeView.editor.getCursor('from');
                  const lineNumber = cursor.line + 1;
                  this.loadText(selection, { fileName, lineNumber });
                  return;
                }
              }

              // Sinon, charger toute la page à partir de la position du curseur
              const fullContent = activeView.editor.getValue();
              if (fullContent && fullContent.trim().length > 50) {
                const cursor = activeView.editor.getCursor();
                const cursorPosition = activeView.editor.posToOffset(cursor);
                this.loadText(fullContent, { fileName, cursorPosition });
              }
            }, 200);
          }
        }
      })
    );

    // Écouter les clics de souris (pour sélection OU déplacement du curseur)
    this.registerDomEvent(document, 'mouseup', () => {
      console.log('DashReader: Mouse click detected');
      setTimeout(() => {
        if (this.mainContainerEl.isShown()) {
          checkSelectionOrCursor();
        }
      }, 50);
    });

    // Écouter les touches de sélection et déplacement
    this.registerDomEvent(document, 'keyup', (evt: KeyboardEvent) => {
      // Déterminer si c'est une touche de navigation
      const isNavigationKey =
        // Touches fléchées
        evt.key === 'ArrowUp' || evt.key === 'ArrowDown' ||
        evt.key === 'ArrowLeft' || evt.key === 'ArrowRight' ||
        // Home/End/PageUp/PageDown
        evt.key === 'Home' || evt.key === 'End' ||
        evt.key === 'PageUp' || evt.key === 'PageDown' ||
        // Enter pour nouvelle ligne
        evt.key === 'Enter' ||
        // Vim-style (j/k pour bas/haut)
        (evt.key === 'j' && evt.ctrlKey) || (evt.key === 'k' && evt.ctrlKey) ||
        (evt.key === 'd' && evt.ctrlKey) || (evt.key === 'u' && evt.ctrlKey) ||
        // Cmd/Ctrl + flèches
        ((evt.key === 'ArrowUp' || evt.key === 'ArrowDown') && (evt.metaKey || evt.ctrlKey));

      // Touches de sélection
      const isSelectionKey = evt.shiftKey || (evt.key === 'a' && (evt.metaKey || evt.ctrlKey));

      if (isNavigationKey || isSelectionKey) {
        console.log('DashReader: Navigation key detected:', evt.key, 'with modifiers:', {
          shift: evt.shiftKey,
          ctrl: evt.ctrlKey,
          meta: evt.metaKey
        });
        setTimeout(() => {
          if (this.mainContainerEl.isShown()) {
            checkSelectionOrCursor();
          }
        }, 50);
      }
    });

    console.log('DashReader: Auto-load setup complete (with file-open event)');
  }

  private setupHotkeys(): void {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  private handleKeyPress(e: KeyboardEvent): void {
    // Seulement si la vue est visible
    if (!this.mainContainerEl.isShown()) return;

    // Toggles rapides
    if (e.key === 'c' && !this.engine.getIsPlaying()) {
      e.preventDefault();
      this.toggleControls();
      return;
    }

    if (e.key === 's' && !this.engine.getIsPlaying()) {
      e.preventDefault();
      this.toggleStats();
      return;
    }

    // Utiliser e.code pour les touches spéciales (Space, Arrow, etc.)
    const keyCode = e.code || e.key;

    // Gérer SEULEMENT Shift+Space pour play/pause (pas Space seul pour éviter de capturer les espaces dans la note)
    if (keyCode === 'Space' && e.shiftKey) {
      e.preventDefault();
      console.log('DashReader: Shift+Space pressed, toggling play');
      this.togglePlay();
      return;
    }

    switch (keyCode) {
      // hotkeyPlay retiré - on utilise seulement Shift+Space
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
        this.changeWpm(25);
        break;
      case this.settings.hotkeyDecrementWpm:
        e.preventDefault();
        this.changeWpm(-25);
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
      this.updatePlayButton(false);
    } else {
      if (this.startTime === 0) {
        this.startTime = Date.now();
      }
      this.engine.play();
      this.updatePlayButton(true);
    }
  }

  private updatePlayButton(isPlaying: boolean): void {
    const playBtn = this.controlsEl.querySelector('.play-btn') as HTMLElement;
    const pauseBtn = this.controlsEl.querySelector('.pause-btn') as HTMLElement;

    if (playBtn && pauseBtn) {
      playBtn.toggleClass('hidden', isPlaying);
      pauseBtn.toggleClass('hidden', !isPlaying);
    }
  }

  private changeWpm(delta: number): void {
    const newWpm = this.engine.getWpm() + delta;
    this.engine.setWpm(newWpm);
    this.settings.wpm = this.engine.getWpm();

    if (this.wpmDisplayEl) {
      this.wpmDisplayEl.setText(`${this.settings.wpm} WPM`);
    }

    const wpmValue = this.controlsEl.querySelector('.wpm-value');
    if (wpmValue) {
      wpmValue.setText(String(this.settings.wpm));
    }
  }

  private changeChunkSize(delta: number): void {
    const newSize = this.engine.getChunkSize() + delta;
    this.engine.setChunkSize(newSize);
    this.settings.chunkSize = this.engine.getChunkSize();

    const chunkValue = this.controlsEl.querySelector('.chunk-value');
    if (chunkValue) {
      chunkValue.setText(String(this.settings.chunkSize));
    }
  }

  private changeFontSize(delta: number): void {
    this.settings.fontSize = Math.max(20, Math.min(120, this.settings.fontSize + delta));
    this.wordEl.style.fontSize = `${this.settings.fontSize}px`;

    const fontValue = this.settingsEl.querySelector('.font-value');
    if (fontValue) {
      fontValue.setText(String(this.settings.fontSize));
    }
  }

  private changeWpmInline(delta: number): void {
    const newWpm = this.engine.getWpm() + delta;
    this.engine.setWpm(newWpm);
    this.settings.wpm = this.engine.getWpm();

    // Mettre à jour l'affichage dans les stats
    if (this.wpmDisplayEl) {
      this.wpmDisplayEl.setText(`${this.settings.wpm} WPM`);
    }

    // Mettre à jour l'affichage dans les contrôles principaux
    const wpmValueControls = this.controlsEl.querySelector('.wpm-value');
    if (wpmValueControls) {
      wpmValueControls.setText(String(this.settings.wpm));
    }

    // Mettre à jour l'affichage dans les settings inline
    const wpmValueInline = this.settingsEl.querySelector('.wpm-inline-value');
    if (wpmValueInline) {
      wpmValueInline.setText(String(this.settings.wpm));
    }
  }

  private changeAccelDuration(delta: number): void {
    this.settings.accelerationDuration = Math.max(10, Math.min(120, this.settings.accelerationDuration + delta));
    this.engine.updateSettings(this.settings);

    const accelDurationValue = this.settingsEl.querySelector('.accel-duration-value');
    if (accelDurationValue) {
      accelDurationValue.setText(String(this.settings.accelerationDuration));
    }
  }

  private changeAccelTarget(delta: number): void {
    this.settings.accelerationTargetWpm = Math.max(50, Math.min(1000, this.settings.accelerationTargetWpm + delta));
    this.engine.updateSettings(this.settings);

    const accelTargetValue = this.settingsEl.querySelector('.accel-target-value');
    if (accelTargetValue) {
      accelTargetValue.setText(String(this.settings.accelerationTargetWpm));
    }
  }

  private onWordChange(chunk: WordChunk): void {
    // Détecter si le mot contient un marqueur de heading [H1], [H2], etc.
    const headingMatch = chunk.text.match(/^\[H(\d)\]/);
    let displayText = chunk.text;
    let headingLevel = 0;
    let showSeparator = false;

    if (headingMatch) {
      headingLevel = parseInt(headingMatch[1]);
      displayText = chunk.text.replace(/^\[H\d\]/, ''); // Enlever le marqueur
      showSeparator = true; // Afficher une ligne avant ce heading
      console.log('DashReader: Heading detected - Level', headingLevel, 'Text:', displayText);
    }

    // Afficher le mot avec ou sans ligne de séparation
    this.displayWordWithHeading(displayText, headingLevel, showSeparator);

    // Mettre à jour le contexte
    if (this.settings.showContext && this.contextBeforeEl && this.contextAfterEl) {
      const context = this.engine.getContext(this.settings.contextWords);
      this.contextBeforeEl.setText(context.before.join(' '));
      this.contextAfterEl.setText(context.after.join(' '));
    }

    // Mettre à jour la progression
    const progress = this.engine.getProgress();
    const progressBar = this.progressEl?.querySelector('.dashreader-progress-bar') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    // Mettre à jour les stats
    this.wordsRead++;
    this.updateStats();
  }

  private displayWordWithHeading(word: string, headingLevel: number, showSeparator: boolean = false): void {
    // Calculer la taille de police basée sur le niveau du heading
    // H1 = 2x, H2 = 1.75x, H3 = 1.5x, H4 = 1.25x, H5 = 1.1x, H6 = 1x, normal = 1x
    let fontSizeMultiplier = 1.0;
    if (headingLevel > 0) {
      const multipliers = [0, 2.0, 1.75, 1.5, 1.25, 1.1, 1.0];
      fontSizeMultiplier = multipliers[headingLevel] || 1.0;
    }

    const adjustedFontSize = this.settings.fontSize * fontSizeMultiplier;

    // Afficher le mot avec highlight du centre
    const processedWord = this.processWord(word);

    // Ajouter une ligne de séparation avant les headings si demandé
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
    // Trouver le centre du mot pour le highlighter
    const cleanWord = word.trim();
    const center = Math.max(Math.floor(cleanWord.length / 2) - 1, 0);

    let result = '';
    for (let i = 0; i < cleanWord.length; i++) {
      if (i === center) {
        result += `<span class="dashreader-highlight" style="color: ${this.settings.highlightColor}">${cleanWord[i]}</span>`;
      } else {
        result += cleanWord[i];
      }
    }

    return result;
  }

  private onComplete(): void {
    this.updatePlayButton(false);
    const statsText = this.statsEl?.querySelector('.dashreader-stats-text');
    if (statsText) {
      statsText.setText('Completed! 🎉');
    }
  }

  private updateStats(): void {
    const statsText = this.statsEl?.querySelector('.dashreader-stats-text');
    if (!statsText) return;

    const elapsed = this.engine.getElapsedTime();
    const currentWpm = this.engine.getCurrentWpmPublic();
    const remaining = this.engine.getRemainingTime();

    statsText.setText(
      `${this.wordsRead}/${this.engine.getTotalWords()} words | ${this.formatTime(elapsed)} | ${currentWpm} WPM | ${this.formatTime(remaining)} left`
    );
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  public loadText(text: string, source?: { fileName?: string; lineNumber?: number; cursorPosition?: number }): void {
    console.log('DashReader: loadText called with source:', source);

    // STOP la lecture en cours si elle existe
    if (this.engine.getIsPlaying()) {
      this.engine.stop();
      this.updatePlayButton(false);
      console.log('DashReader: Stopped current reading');
    }

    // Parser le Markdown FIRST pour enlever la syntaxe
    console.log('DashReader: Parsing markdown, original length:', text.length);
    const plainText = MarkdownParser.parseToPlainText(text);
    console.log('DashReader: After parsing, length:', plainText.length);
    console.log('DashReader: First 100 chars:', plainText.substring(0, 100));

    // ENSUITE calculer l'index du mot dans le texte parsé
    let wordIndexFromCursor: number | undefined;
    if (source?.cursorPosition !== undefined) {
      console.log('DashReader: Cursor position detected:', source.cursorPosition);

      // Parser aussi le texte jusqu'au curseur
      const textUpToCursor = text.substring(0, source.cursorPosition);
      const parsedUpToCursor = MarkdownParser.parseToPlainText(textUpToCursor);

      // Compter les mots dans le texte parsé jusqu'au curseur
      const wordsBeforeCursor = parsedUpToCursor.trim().split(/\s+/).filter(w => w.length > 0);
      wordIndexFromCursor = wordsBeforeCursor.length;

      console.log('DashReader: Original text up to cursor:', textUpToCursor.length, 'chars');
      console.log('DashReader: Parsed text up to cursor:', parsedUpToCursor.length, 'chars');
      console.log('DashReader: Words before cursor (after parsing):', wordsBeforeCursor.slice(0, 10), '...');
      console.log('DashReader: Cursor at character', source.cursorPosition, '→ word index', wordIndexFromCursor, '(in parsed text)');
    } else {
      console.log('DashReader: No cursor position provided');
    }

    // Vérifier qu'il y a du texte
    if (!plainText || plainText.trim().length < 10) {
      console.log('DashReader: Text too short after parsing');
      return;
    }

    // Passer l'index du mot (calculé APRÈS parsing) au moteur
    this.engine.setText(plainText, undefined, wordIndexFromCursor);
    this.wordsRead = 0;
    this.startTime = 0;

    // Enlever le message de bienvenue
    const welcomeMsg = this.wordEl.querySelector('.dashreader-welcome');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    // Afficher le premier mot
    this.wordEl.innerHTML = '';

    // Préparer le message avec le nom du document et ligne
    let sourceInfo = '';
    if (source?.fileName) {
      sourceInfo = `<div style="font-size: 14px; opacity: 0.6; margin-bottom: 8px;">
        📄 ${source.fileName}${source.lineNumber ? ` (line ${source.lineNumber})` : ''}
      </div>`;
    }

    // Calculer les mots restants et la durée estimée
    const totalWords = this.engine.getTotalWords();
    const remainingWords = this.engine.getRemainingWords();
    const estimatedDuration = this.engine.getEstimatedDuration();
    const durationText = this.formatTime(estimatedDuration);

    const statsText = this.statsEl?.querySelector('.dashreader-stats-text');
    if (statsText) {
      const fileInfo = source?.fileName ? ` from ${source.fileName}` : '';
      const wordInfo = wordIndexFromCursor && wordIndexFromCursor > 0
        ? `${remainingWords}/${totalWords} words`
        : `${totalWords} words`;
      statsText.setText(`${wordInfo} loaded${fileInfo} - ~${durationText} - Shift+Space to start`);
    }

    // Afficher un message dans la zone de mot avec info du document et durée
    const startInfo = wordIndexFromCursor !== undefined && wordIndexFromCursor > 0
      ? ` <span style="opacity: 0.6;">(starting at word ${wordIndexFromCursor + 1}/${totalWords})</span>`
      : '';

    console.log('DashReader: Start info display:', startInfo);
    console.log('DashReader: Words to read:', remainingWords, 'out of', totalWords);

    this.wordEl.innerHTML = `
      <div style="font-size: 18px; color: var(--text-muted); text-align: center;">
        ${sourceInfo}
        Ready to read ${remainingWords} words${startInfo}<br/>
        <span style="font-size: 14px; opacity: 0.7;">Estimated time: ~${durationText}</span><br/>
        <span style="font-size: 14px; opacity: 0.7;">Press Shift+Space to start</span>
      </div>
    `;

    // Auto-start si activé
    if (this.settings.autoStart) {
      setTimeout(() => {
        this.engine.play();
        this.updatePlayButton(true);
        this.startTime = Date.now();
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

    if (this.wpmDisplayEl) {
      this.wpmDisplayEl.setText(`${settings.wpm} WPM`);
    }
  }

  async onClose(): Promise<void> {
    this.engine.stop();
  }
}
