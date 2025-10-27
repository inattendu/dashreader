import { DashReaderSettings, WordChunk, HeadingInfo, HeadingContext } from './types';

export class RSVPEngine {
  private words: string[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private timer: number | null = null;
  private settings: DashReaderSettings;
  private onWordChange: (chunk: WordChunk) => void;
  private onComplete: () => void;
  private startTime: number = 0;
  private startWpm: number = 0;
  private pausedTime: number = 0;
  private lastPauseTime: number = 0;
  private headings: HeadingInfo[] = [];
  private wordsReadInSession: number = 0;

  constructor(
    settings: DashReaderSettings,
    onWordChange: (chunk: WordChunk) => void,
    onComplete: () => void
  ) {
    this.settings = settings;
    this.onWordChange = onWordChange;
    this.onComplete = onComplete;
  }

  setText(text: string, startPosition?: number, startWordIndex?: number): void {
    console.log('DashReader Engine: setText called with startPosition:', startPosition, 'startWordIndex:', startWordIndex);

    // Nettoyer et diviser le texte en mots
    const cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    this.words = cleaned.split(/\s+/);
    console.log('DashReader Engine: Total words after split:', this.words.length);

    // Extraire les headings avec leur position
    this.extractHeadings();
    console.log('DashReader Engine: Extracted', this.headings.length, 'headings');

    // Utiliser l'index du mot si fourni (prioritaire)
    if (startWordIndex !== undefined) {
      this.currentIndex = Math.max(0, Math.min(startWordIndex, this.words.length - 1));
      console.log('DashReader Engine: Starting at word index', this.currentIndex, '/', this.words.length, '(from startWordIndex)');
    } else if (startPosition !== undefined && startPosition > 0) {
      // Fallback: calculer depuis la position (deprecated)
      const textUpToCursor = text.substring(0, startPosition);
      const wordsBeforeCursor = textUpToCursor.trim().split(/\s+/).length;
      this.currentIndex = Math.min(wordsBeforeCursor, this.words.length - 1);
      console.log('DashReader Engine: Starting at word index', this.currentIndex, '/', this.words.length, '(from startPosition)');
    } else {
      this.currentIndex = 0;
      console.log('DashReader Engine: Starting at beginning (no start position)');
    }
  }

  play(): void {
    if (this.isPlaying) return;
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }

    this.isPlaying = true;

    // Initialiser le temps de début et le WPM de départ
    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.startWpm = this.settings.wpm;
      this.wordsReadInSession = 0; // Reset slow start counter
    } else if (this.lastPauseTime > 0) {
      // Si on reprend après une pause, ajouter le temps de pause
      this.pausedTime += Date.now() - this.lastPauseTime;
      this.lastPauseTime = 0;
    }

    this.displayNextWord();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    // Enregistrer le moment de la pause
    this.lastPauseTime = Date.now();
  }

  stop(): void {
    this.pause();
    this.currentIndex = 0;
    // Réinitialiser les temps
    this.startTime = 0;
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    this.startWpm = 0;
    this.wordsReadInSession = 0; // Reset slow start counter
  }

  reset(): void {
    this.stop();
  }

  rewind(steps: number = 10): void {
    this.currentIndex = Math.max(0, this.currentIndex - steps);
    if (this.isPlaying) {
      this.pause();
      this.play();
    } else {
      this.displayCurrentWord();
    }
  }

  forward(steps: number = 10): void {
    this.currentIndex = Math.min(this.words.length - 1, this.currentIndex + steps);
    if (this.isPlaying) {
      this.pause();
      this.play();
    } else {
      this.displayCurrentWord();
    }
  }

  private displayCurrentWord(): void {
    if (this.currentIndex >= this.words.length) {
      return;
    }

    const chunk = this.getChunk(this.currentIndex);
    this.onWordChange(chunk);
  }

  private displayNextWord(): void {
    if (!this.isPlaying || this.currentIndex >= this.words.length) {
      if (this.currentIndex >= this.words.length) {
        this.isPlaying = false;
        this.onComplete();
      }
      return;
    }

    const chunk = this.getChunk(this.currentIndex);
    this.onWordChange(chunk);

    let delay = this.calculateDelay(chunk.text);

    // Slow start: gradually increase speed over first 5 words
    // Inspired by Stutter: ease into reading to avoid jarring start
    const SLOW_START_WORDS = 5;
    if (this.wordsReadInSession < SLOW_START_WORDS) {
      const remainingSlowWords = SLOW_START_WORDS - this.wordsReadInSession;
      const slowStartMultiplier = 1 + (remainingSlowWords / SLOW_START_WORDS);
      delay *= slowStartMultiplier;
    }

    this.wordsReadInSession++;
    this.currentIndex += this.settings.chunkSize;

    this.timer = window.setTimeout(() => {
      this.displayNextWord();
    }, delay);
  }

  private getChunk(startIndex: number): WordChunk {
    const endIndex = Math.min(
      startIndex + this.settings.chunkSize,
      this.words.length
    );

    const chunkWords = this.words.slice(startIndex, endIndex);
    const text = chunkWords.join(' ');

    return {
      text,
      index: startIndex,
      delay: this.calculateDelay(text),
      isEnd: endIndex >= this.words.length,
      headingContext: this.getCurrentHeadingContext(startIndex)
    };
  }

  private getCurrentWpm(): number {
    // Si l'accélération n'est pas activée, retourner le WPM normal
    if (!this.settings.enableAcceleration || this.startTime === 0) {
      return this.settings.wpm;
    }

    // Calculer le temps écoulé (en secondes)
    const elapsed = (Date.now() - this.startTime - this.pausedTime) / 1000;

    // Si on a dépassé la durée d'accélération, retourner le WPM cible
    if (elapsed >= this.settings.accelerationDuration) {
      return this.settings.accelerationTargetWpm;
    }

    // Calculer le WPM progressif
    const progress = elapsed / this.settings.accelerationDuration;
    const wpmDiff = this.settings.accelerationTargetWpm - this.startWpm;
    const currentWpm = this.startWpm + (wpmDiff * progress);

    return Math.round(currentWpm);
  }

  private calculateDelay(text: string): number {
    const currentWpm = this.getCurrentWpm();
    const baseDelay = (60 / currentWpm) * 1000;

    if (!this.settings.enableMicropause) {
      return baseDelay;
    }

    let multiplier = 1.0;

    // Détection des sections et énumérations (début de texte)
    const trimmedText = text.trim();

    // Micropause pour les headings Markdown [H1], [H2], etc.
    const headingMatch = trimmedText.match(/^\[H(\d)\]/);
    if (headingMatch) {
      const level = parseInt(headingMatch[1]);
      // Plus le niveau est bas (H1 = 1), plus la pause est longue
      // H1 = 2.0x, H2 = 1.8x, H3 = 1.5x, H4 = 1.3x, H5 = 1.2x, H6 = 1.1x
      const headingMultipliers = [0, 2.0, 1.8, 1.5, 1.3, 1.2, 1.1];
      multiplier *= headingMultipliers[level] || 1.5;
    }

    // Micropause pour les callouts Obsidian [CALLOUT:type]
    const calloutMatch = trimmedText.match(/^\[CALLOUT:[\w-]+\]/);
    if (calloutMatch) {
      multiplier *= this.settings.micropauseCallouts;
    }

    // Micropause pour numéros de section (1., 2., I., II., etc.)
    if (/^(\d+\.|[IVXLCDM]+\.|\w\.)/.test(trimmedText)) {
      multiplier *= this.settings.micropauseSectionMarkers;
    }

    // Micropause pour puces de liste (-, *, +, •)
    if (/^[-*+•]/.test(trimmedText)) {
      multiplier *= this.settings.micropauseListBullets;
    }

    // Micropause pour la ponctuation (fin de texte)
    // Distinction: sentences (.,!?) vs other punctuation (:;,)
    if (/[.!?]$/.test(text)) {
      // Sentence-ending punctuation: full pause
      multiplier *= this.settings.micropausePunctuation;
    } else if (/[;:,]$/.test(text)) {
      // Other punctuation: lighter pause
      multiplier *= this.settings.micropauseOtherPunctuation;
    }

    // Micropause pour les nombres (dates, statistiques, années, etc.)
    if (/\d/.test(text)) {
      multiplier *= this.settings.micropauseNumbers;
    }

    // Micropause pour les mots longs (>8 caractères)
    if (text.length > 8) {
      multiplier *= this.settings.micropauseLongWords;
    }

    // Micropause pour les sauts de paragraphe
    if (text.includes('\n')) {
      multiplier *= this.settings.micropauseParagraph;
    }

    return baseDelay * multiplier;
  }

  /**
   * Extract all headings and callouts from the words array
   * Headings are marked with [H1], [H2], etc.
   * Callouts are marked with [CALLOUT:type] by the markdown parser
   */
  private extractHeadings(): void {
    this.headings = [];

    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];

      // Check for regular headings [H1], [H2], etc.
      const headingMatch = word.match(/^\[H(\d)\](.+)/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        const text = headingMatch[2];

        this.headings.push({
          level,
          text,
          wordIndex: i
        });
        continue;
      }

      // Check for callouts [CALLOUT:type]Title
      const calloutMatch = word.match(/^\[CALLOUT:([\w-]+)\](.+)/);
      if (calloutMatch) {
        const calloutType = calloutMatch[1];
        const text = calloutMatch[2];

        this.headings.push({
          level: 0, // Special level for callouts
          text,
          wordIndex: i,
          calloutType
        });
      }
    }
  }

  /**
   * Get the current heading context (breadcrumb) for a given word index
   * Returns the hierarchical path of headings leading to the current position
   */
  private getCurrentHeadingContext(wordIndex: number): HeadingContext {
    if (this.headings.length === 0) {
      return { breadcrumb: [], current: null };
    }

    // Find all headings before or at the current position
    const relevantHeadings = this.headings.filter(h => h.wordIndex <= wordIndex);

    if (relevantHeadings.length === 0) {
      return { breadcrumb: [], current: null };
    }

    // Build hierarchical breadcrumb
    const breadcrumb: HeadingInfo[] = [];
    let currentLevel = 0;

    for (const heading of relevantHeadings) {
      // If this heading is at a lower or equal level than current, reset the breadcrumb up to this level
      if (heading.level <= currentLevel) {
        // Remove all headings from this level onwards
        while (breadcrumb.length > 0 && breadcrumb[breadcrumb.length - 1].level >= heading.level) {
          breadcrumb.pop();
        }
      }

      breadcrumb.push(heading);
      currentLevel = heading.level;
    }

    return {
      breadcrumb,
      current: breadcrumb[breadcrumb.length - 1] || null
    };
  }

  getProgress(): number {
    return this.words.length > 0
      ? (this.currentIndex / this.words.length) * 100
      : 0;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalWords(): number {
    return this.words.length;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setWpm(wpm: number): void {
    this.settings.wpm = Math.max(50, Math.min(1000, wpm));
  }

  getWpm(): number {
    return this.settings.wpm;
  }

  setChunkSize(size: number): void {
    this.settings.chunkSize = Math.max(1, Math.min(5, size));
  }

  getChunkSize(): number {
    return this.settings.chunkSize;
  }

  getContext(contextWords: number = 3): { before: string[], after: string[] } {
    const beforeStart = Math.max(0, this.currentIndex - contextWords);
    const afterEnd = Math.min(this.words.length, this.currentIndex + this.settings.chunkSize + contextWords);

    return {
      before: this.words.slice(beforeStart, this.currentIndex),
      after: this.words.slice(this.currentIndex + this.settings.chunkSize, afterEnd)
    };
  }

  updateSettings(settings: DashReaderSettings): void {
    this.settings = settings;
  }

  getEstimatedDuration(): number {
    // Retourne la durée estimée en secondes pour lire les mots RESTANTS
    // Calcul précis avec toutes les micropauses (ponctuation, mots longs, headings, etc.)
    if (this.words.length === 0) return 0;

    const remainingWords = Math.max(0, this.words.length - this.currentIndex);
    if (remainingWords === 0) return 0;

    const averageWpm = this.settings.enableAcceleration
      ? (this.settings.wpm + this.settings.accelerationTargetWpm) / 2
      : this.settings.wpm;

    // Calculer le temps précis en tenant compte de toutes les micropauses
    return this.calculateAccurateRemainingTime(averageWpm);
  }

  private calculateAccurateRemainingTime(wpm: number): number {
    // Calcule le temps total en millisecondes pour lire tous les mots restants
    // en tenant compte de TOUTES les micropauses (ponctuation, mots longs, headings, etc.)
    if (this.words.length === 0 || this.currentIndex >= this.words.length) return 0;

    let totalTimeMs = 0;
    const baseDelay = (60 / wpm) * 1000; // Délai de base par mot en ms

    for (let i = this.currentIndex; i < this.words.length; i++) {
      const word = this.words[i];

      if (!this.settings.enableMicropause) {
        // Sans micropause, juste le délai de base
        totalTimeMs += baseDelay;
        continue;
      }

      // Calculer le multiplicateur de micropause pour ce mot
      let multiplier = 1.0;
      const trimmedText = word.trim();

      // Micropause pour les headings Markdown [H1], [H2], etc.
      const headingMatch = trimmedText.match(/^\[H(\d)\]/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        const headingMultipliers = [0, 2.0, 1.8, 1.5, 1.3, 1.2, 1.1];
        multiplier *= headingMultipliers[level] || 1.5;
      }

      // Micropause pour les callouts Obsidian [CALLOUT:type]
      const calloutMatch = trimmedText.match(/^\[CALLOUT:[\w-]+\]/);
      if (calloutMatch) {
        multiplier *= this.settings.micropauseCallouts;
      }

      // Micropause pour numéros de section (1., 2., I., II., etc.)
      if (/^(\d+\.|[IVXLCDM]+\.|\w\.)/.test(trimmedText)) {
        multiplier *= this.settings.micropauseSectionMarkers;
      }

      // Micropause pour puces de liste (-, *, +, •)
      if (/^[-*+•]/.test(trimmedText)) {
        multiplier *= this.settings.micropauseListBullets;
      }

      // Micropause pour la ponctuation (fin de texte)
      // Distinction: sentences (.,!?) vs other punctuation (:;,)
      if (/[.!?]$/.test(word)) {
        // Sentence-ending punctuation: full pause
        multiplier *= this.settings.micropausePunctuation;
      } else if (/[;:,]$/.test(word)) {
        // Other punctuation: lighter pause
        multiplier *= this.settings.micropauseOtherPunctuation;
      }

      // Micropause pour les nombres (dates, statistiques, années, etc.)
      if (/\d/.test(word)) {
        multiplier *= this.settings.micropauseNumbers;
      }

      // Micropause pour les mots longs (>8 caractères)
      if (word.length > 8) {
        multiplier *= this.settings.micropauseLongWords;
      }

      // Micropause pour les sauts de paragraphe
      if (word.includes('\n')) {
        multiplier *= this.settings.micropauseParagraph;
      }

      totalTimeMs += baseDelay * multiplier;
    }

    // Convertir en secondes et arrondir
    return Math.ceil(totalTimeMs / 1000);
  }

  getRemainingWords(): number {
    // Retourne le nombre de mots restants à lire
    return Math.max(0, this.words.length - this.currentIndex);
  }

  getElapsedTime(): number {
    // Retourne le temps écoulé en secondes
    if (this.startTime === 0) return 0;

    const now = this.isPlaying ? Date.now() : this.lastPauseTime || Date.now();
    return Math.floor((now - this.startTime - this.pausedTime) / 1000);
  }

  getRemainingTime(): number {
    // Retourne le temps restant estimé en secondes
    // Calcul précis avec toutes les micropauses (ponctuation, mots longs, headings, etc.)
    if (this.words.length === 0 || this.currentIndex >= this.words.length) return 0;

    const currentWpm = this.getCurrentWpm();

    // Calculer le temps précis en tenant compte de toutes les micropauses
    return this.calculateAccurateRemainingTime(currentWpm);
  }

  getCurrentWpmPublic(): number {
    // Méthode publique pour obtenir le WPM actuel (pour affichage)
    return this.getCurrentWpm();
  }
}
