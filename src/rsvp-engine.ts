import { DashReaderSettings, WordChunk, HeadingInfo, HeadingContext } from './types';
import { TimeoutManager } from './services/timeout-manager';
import { MicropauseService } from './services/micropause-service';

export class RSVPEngine {
  private words: string[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private timer: number | null = null;
  private settings: DashReaderSettings;
  private timeoutManager: TimeoutManager;
  private micropauseService: MicropauseService;
  private onWordChange: (chunk: WordChunk) => void;
  private onComplete: () => void;
  private startTime: number = 0;
  private startWpm: number = 0;
  private pausedTime: number = 0;
  private lastPauseTime: number = 0;
  private headings: HeadingInfo[] = [];
  private wordsReadInSession: number = 0;

  // Virtual Timeline: pre-calculated cumulative times for each word
  private virtualTimeAtIndexMs: number[] = [];
  private virtualTotalMs: number = 0;

  // Precise timing with drift compensation
  private tickGen: number = 0;
  private nextDueMs: number | null = null;

  // Mobile profile mode
  private useMobileProfile: boolean = false;

  constructor(
    settings: DashReaderSettings,
    onWordChange: (chunk: WordChunk) => void,
    onComplete: () => void,
    timeoutManager: TimeoutManager
  ) {
    this.settings = settings;
    this.onWordChange = onWordChange;
    this.onComplete = onComplete;
    this.timeoutManager = timeoutManager;
    this.micropauseService = new MicropauseService(settings);
  }

  setText(text: string, startPosition?: number, startWordIndex?: number): void {
    // Nettoyer et diviser le texte en mots
    // Important: preserve line breaks by replacing them with a marker FIRST
    const cleaned = text
      .replace(/\n+/g, ' §§LINEBREAK§§ ')  // Replace line breaks FIRST
      .replace(/[ \t]+/g, ' ')              // Then clean up spaces/tabs (NOT \n!)
      .trim();

    this.words = cleaned.split(/\s+/);

    // Extraire les headings avec leur position (before replacing markers)
    this.extractHeadings();

    // Replace line break markers with actual line breaks for display
    this.words = this.words.map(word =>
      word === '§§LINEBREAK§§' ? '\n' : word
    );

    // Utiliser l'index du mot si fourni (prioritaire)
    if (startWordIndex !== undefined) {
      this.currentIndex = Math.max(0, Math.min(startWordIndex, this.words.length - 1));
    } else if (startPosition !== undefined && startPosition > 0) {
      // Fallback: calculer depuis la position (deprecated)
      const textUpToCursor = text.substring(0, startPosition);
      const wordsBeforeCursor = textUpToCursor.trim().split(/\s+/).length;
      this.currentIndex = Math.min(wordsBeforeCursor, this.words.length - 1);
    } else {
      this.currentIndex = 0;
    }

    // Build virtual timeline for accurate time estimates
    this.rebuildVirtualTimeline();
  }

  /**
   * Pre-calculates cumulative times for all words
   * This enables accurate time estimation and time-based navigation
   */
  private rebuildVirtualTimeline(): void {
    const n = this.words.length;
    this.virtualTimeAtIndexMs = new Array(n).fill(0);
    this.virtualTotalMs = 0;

    if (n === 0) return;

    let tMs = 0;
    let sessionWordCount = 0;
    const SLOW_START_WORDS = 5;

    for (let i = 0; i < n; i++) {
      this.virtualTimeAtIndexMs[i] = tMs;

      const word = this.words[i];

      // Line breaks have zero delay
      if (word === '\n') continue;

      // Get WPM at this virtual elapsed time (for acceleration)
      const wpm = this.getWpmAtElapsedSeconds(tMs / 1000);
      const baseDelay = (60 / wpm) * 1000;

      // Calculate micropause multiplier
      const multiplier = this.micropauseService.calculateMultiplier(word);
      let delay = baseDelay * multiplier;

      // Apply slow start if enabled (mobile-aware)
      if (this.getEnableSlowStartSetting() && sessionWordCount < SLOW_START_WORDS) {
        const remainingSlowWords = SLOW_START_WORDS - sessionWordCount;
        const slowStartMultiplier = 1 + (remainingSlowWords / SLOW_START_WORDS);
        delay *= slowStartMultiplier;
      }

      sessionWordCount++;
      tMs += Math.max(0, delay);
    }

    this.virtualTotalMs = tMs;
  }

  /**
   * Gets the WPM at a given elapsed time (for acceleration calculation)
   * Uses mobile-aware base WPM
   * @param elapsedSeconds - Virtual elapsed time in seconds
   */
  private getWpmAtElapsedSeconds(elapsedSeconds: number): number {
    const baseWpm = this.getWpmSetting();

    if (!this.settings.enableAcceleration) {
      return baseWpm;
    }

    if (elapsedSeconds >= this.settings.accelerationDuration) {
      return this.settings.accelerationTargetWpm;
    }

    const progress = elapsedSeconds / this.settings.accelerationDuration;
    const wpmDiff = this.settings.accelerationTargetWpm - baseWpm;
    return Math.round(baseWpm + (wpmDiff * progress));
  }

  /**
   * Returns monotonic time in milliseconds (more precise than Date.now())
   */
  private nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  play(): void {
    if (this.isPlaying) return;
    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }

    this.isPlaying = true;
    this.tickGen++; // Invalidate any pending callbacks

    // Initialiser le temps de début et le WPM de départ
    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.startWpm = this.settings.wpm;
      this.wordsReadInSession = 0; // Reset slow start counter
      this.nextDueMs = null; // Reset timing anchor
    } else if (this.lastPauseTime > 0) {
      // Si on reprend après une pause, ajouter le temps de pause
      this.pausedTime += Date.now() - this.lastPauseTime;
      this.lastPauseTime = 0;
      this.nextDueMs = null; // Reset timing anchor on resume
    }

    this.displayNextWord();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timer !== null) {
      this.timeoutManager.clearTimeout(this.timer);
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
    this.nextDueMs = null; // Reset timing anchor
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

    const gen = this.tickGen; // Capture current generation
    const chunk = this.getChunk(this.currentIndex);
    this.onWordChange(chunk);

    let delay = this.calculateDelay(chunk.text);

    // Slow start: gradually increase speed over first 5 words (if enabled, mobile-aware)
    // Inspired by Stutter: ease into reading to avoid jarring start
    if (this.getEnableSlowStartSetting()) {
      const SLOW_START_WORDS = 5;
      if (this.wordsReadInSession < SLOW_START_WORDS) {
        const remainingSlowWords = SLOW_START_WORDS - this.wordsReadInSession;
        const slowStartMultiplier = 1 + (remainingSlowWords / SLOW_START_WORDS);
        delay *= slowStartMultiplier;
      }
    }

    this.wordsReadInSession++;
    this.currentIndex += this.getChunkSizeSetting();

    // Precise timing with drift compensation
    const now = this.nowMs();

    // Anchor on first tick of this session
    if (this.nextDueMs === null) {
      this.nextDueMs = now;
    }

    this.nextDueMs += delay;
    let waitMs = this.nextDueMs - now;

    // Resync if too far behind (e.g., tab was throttled)
    if (waitMs < -250) {
      this.nextDueMs = now + delay;
      waitMs = delay;
    }

    this.timer = this.timeoutManager.setTimeout(() => {
      // Check if this callback is still valid (not from a stale play session)
      if (gen !== this.tickGen) return;
      this.displayNextWord();
    }, Math.max(0, waitMs));
  }

  private getChunk(startIndex: number): WordChunk {
    const chunkSize = this.getChunkSizeSetting();
    const endIndex = Math.min(
      startIndex + chunkSize,
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
    const baseWpm = this.getWpmSetting();

    // Si l'accélération n'est pas activée, retourner le WPM de base (mobile ou desktop)
    if (!this.settings.enableAcceleration || this.startTime === 0) {
      return baseWpm;
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

    // Calculate micropause multiplier using service
    const multiplier = this.micropauseService.calculateMultiplier(text);

    return baseDelay * multiplier;
  }

  /**
   * Extract all headings and callouts from the words array
   * Headings are marked with [H1], [H2], etc.
   * Callouts are marked with [CALLOUT:type] by the markdown parser
   *
   * Since text is split into words, we need to collect all words
   * that belong to the same heading/callout title.
   */
  private extractHeadings(): void {
    this.headings = [];

    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];

      // Check for regular headings [H1], [H2], etc.
      const headingMatch = word.match(/^\[H(\d)\](.+)/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1]);
        const firstWord = headingMatch[2];

        // Collect following words until we hit a line break marker
        // Headings are single-line, so we stop at §§LINEBREAK§§
        const titleWords = [firstWord];
        let j = i + 1;
        while (j < this.words.length) {
          const nextWord = this.words[j];

          // Stop if we hit the line break marker
          if (nextWord === '§§LINEBREAK§§') {
            break;
          }

          // Stop if we hit another marker
          if (/^\[H\d\]/.test(nextWord) || /^\[CALLOUT:/.test(nextWord)) {
            break;
          }

          // Add word to title
          titleWords.push(nextWord);
          j++;

          // Safety limit: max 20 words for a heading
          if (titleWords.length >= 20) {
            break;
          }
        }

        const text = titleWords.join(' ').trim();

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
        const firstWord = calloutMatch[2];

        // Collect following words until we hit a line break marker
        // Callout titles are single-line, so we stop at §§LINEBREAK§§
        const titleWords = [firstWord];
        let j = i + 1;
        while (j < this.words.length) {
          const nextWord = this.words[j];

          // Stop if we hit the line break marker
          if (nextWord === '§§LINEBREAK§§') {
            break;
          }

          // Stop if we hit another marker
          if (/^\[H\d\]/.test(nextWord) || /^\[CALLOUT:/.test(nextWord)) {
            break;
          }

          // Add word to title
          titleWords.push(nextWord);
          j++;

          // Safety limit: max 20 words for a callout title
          if (titleWords.length >= 20) {
            break;
          }
        }

        const text = titleWords.join(' ').trim();

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
   *
   * @param wordIndex - Word index to get context for
   * @returns Heading context with breadcrumb path and current heading
   */
  getCurrentHeadingContext(wordIndex: number): HeadingContext {
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
    this.micropauseService.updateSettings(settings, this.getEnableMicropauseSetting());
    // Rebuild virtual timeline when settings change
    this.rebuildVirtualTimeline();
  }

  // ============================================================================
  // MOBILE PROFILE SUPPORT
  // ============================================================================

  /**
   * Enables or disables mobile profile mode
   * When enabled, mobile-specific settings override desktop settings
   */
  setUseMobileProfile(useMobile: boolean): void {
    this.useMobileProfile = useMobile;
    this.micropauseService.updateSettings(this.settings, this.getEnableMicropauseSetting());
    this.rebuildVirtualTimeline();
  }

  /**
   * Returns whether mobile profile is active
   */
  getUseMobileProfile(): boolean {
    return this.useMobileProfile;
  }

  /**
   * Gets the effective WPM setting (mobile or desktop)
   */
  private getWpmSetting(): number {
    return this.useMobileProfile ? this.settings.mobileWpm : this.settings.wpm;
  }

  /**
   * Gets the effective chunk size setting (mobile or desktop)
   */
  private getChunkSizeSetting(): number {
    return this.useMobileProfile ? this.settings.mobileChunkSize : this.settings.chunkSize;
  }

  /**
   * Gets the effective slow start setting (mobile or desktop)
   */
  private getEnableSlowStartSetting(): boolean {
    return this.useMobileProfile ? this.settings.mobileEnableSlowStart : this.settings.enableSlowStart;
  }

  /**
   * Gets the effective micropause setting (mobile or desktop)
   */
  private getEnableMicropauseSetting(): boolean {
    return this.useMobileProfile ? this.settings.mobileEnableMicropause : this.settings.enableMicropause;
  }

  /**
   * Gets the effective font size setting (mobile or desktop)
   * Note: This is used by the view, not the engine
   */
  getEffectiveFontSize(): number {
    return this.useMobileProfile ? this.settings.mobileFontSize : this.settings.fontSize;
  }

  /**
   * Gets the effective show breadcrumb setting (mobile or desktop)
   * Note: This is used by the view, not the engine
   */
  getEffectiveShowBreadcrumb(): boolean {
    return this.useMobileProfile ? this.settings.mobileShowBreadcrumb : this.settings.showBreadcrumb;
  }

  /**
   * Gets the effective context words setting (mobile or desktop)
   * Note: This is used by the view, not the engine
   */
  getEffectiveContextWords(): number {
    return this.useMobileProfile ? this.settings.mobileContextWords : this.settings.contextWords;
  }

  /**
   * Gets the effective context font size setting (mobile or desktop)
   * Note: This is used by the view, not the engine
   */
  getEffectiveContextFontSize(): number {
    return this.useMobileProfile ? this.settings.mobileContextFontSize : this.settings.contextFontSize;
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

      // Calculate micropause multiplier using service
      const multiplier = this.micropauseService.calculateMultiplier(word);

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

  /**
   * Returns the total estimated duration for the entire document (from start to end)
   * This is a fixed value that doesn't change with current position
   */
  getTotalEstimatedDuration(): number {
    if (this.words.length === 0) return 0;

    const averageWpm = this.settings.enableAcceleration
      ? (this.settings.wpm + this.settings.accelerationTargetWpm) / 2
      : this.settings.wpm;

    return this.calculateTimeForRange(0, this.words.length, averageWpm);
  }

  /**
   * Returns the estimated time to reach the current position (from start)
   * Used for displaying "elapsed" time based on position, not real time
   */
  getEstimatedTimeAtCurrentPosition(): number {
    if (this.words.length === 0 || this.currentIndex === 0) return 0;

    const averageWpm = this.settings.enableAcceleration
      ? (this.settings.wpm + this.settings.accelerationTargetWpm) / 2
      : this.settings.wpm;

    return this.calculateTimeForRange(0, this.currentIndex, averageWpm);
  }

  /**
   * Calculates the estimated reading time for a range of words
   */
  private calculateTimeForRange(startIndex: number, endIndex: number, wpm: number): number {
    if (startIndex >= endIndex) return 0;

    let totalTimeMs = 0;
    const baseDelay = (60 / wpm) * 1000;

    for (let i = startIndex; i < endIndex; i++) {
      const word = this.words[i];
      const multiplier = this.micropauseService.calculateMultiplier(word);
      totalTimeMs += baseDelay * multiplier;
    }

    return Math.ceil(totalTimeMs / 1000);
  }

  getCurrentWpmPublic(): number {
    // Méthode publique pour obtenir le WPM actuel (pour affichage)
    return this.getCurrentWpm();
  }

  /**
   * Returns all headings extracted from the document
   * Useful for navigation and section counting
   */
  getHeadings(): HeadingInfo[] {
    return this.headings;
  }

  /**
   * Returns the words array for direct access
   * Used by fullscreen modal to display current word
   */
  getWords(): string[] {
    return this.words;
  }

  /**
   * Returns the current onWordChange callback
   * Used by fullscreen modal to save and restore callbacks
   */
  getOnWordChangeCallback(): ((chunk: WordChunk) => void) | null {
    return this.onWordChange;
  }

  /**
   * Returns the current onComplete callback
   * Used by fullscreen modal to save and restore callbacks
   */
  getOnCompleteCallback(): (() => void) | null {
    return this.onComplete;
  }

  /**
   * Sets new callbacks for word change and completion
   * Used by fullscreen modal to redirect engine events
   */
  setCallbacks(
    onWordChange: (chunk: WordChunk) => void,
    onComplete: () => void
  ): void {
    this.onWordChange = onWordChange;
    this.onComplete = onComplete;
  }

  /**
   * Navigates to a specific word index
   * Used by minimap and fullscreen navigation
   */
  goToIndex(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.words.length - 1));
    if (this.isPlaying) {
      this.pause();
      this.play();
    } else {
      this.displayCurrentWord();
    }
  }

  // ============================================================================
  // VIRTUAL TIMELINE PUBLIC METHODS
  // ============================================================================

  /**
   * Returns the total virtual duration in seconds
   * Pre-calculated for accuracy
   */
  getVirtualTotalSeconds(): number {
    return Math.round(this.virtualTotalMs / 1000);
  }

  /**
   * Returns the virtual elapsed time at a specific word index
   * @param index - Word index
   */
  getVirtualElapsedSecondsAtIndex(index: number): number {
    const idx = Math.max(0, Math.min(index, this.words.length - 1));
    return Math.round((this.virtualTimeAtIndexMs[idx] || 0) / 1000);
  }

  /**
   * Returns the virtual elapsed time at current position
   */
  getVirtualElapsedSeconds(): number {
    return this.getVirtualElapsedSecondsAtIndex(this.currentIndex);
  }

  /**
   * Returns the virtual remaining time from current position
   */
  getVirtualRemainingSeconds(): number {
    return Math.max(0, this.getVirtualTotalSeconds() - this.getVirtualElapsedSeconds());
  }

  /**
   * Finds the word index closest to a target time (in seconds)
   * Uses binary search for efficiency
   * @param targetSeconds - Target time in seconds
   */
  findIndexAtTime(targetSeconds: number): number {
    const targetMs = targetSeconds * 1000;
    const n = this.virtualTimeAtIndexMs.length;

    if (n === 0) return 0;
    if (targetMs <= 0) return 0;
    if (targetMs >= this.virtualTotalMs) return n - 1;

    // Binary search for the index
    let lo = 0;
    let hi = n - 1;

    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (this.virtualTimeAtIndexMs[mid] <= targetMs) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    return lo;
  }

  /**
   * Navigate to a specific time position (in seconds)
   * @param seconds - Target time in seconds
   */
  goToTime(seconds: number): void {
    const index = this.findIndexAtTime(seconds);
    this.goToIndex(index);
  }

  /**
   * Rewind by a specified number of seconds
   * @param seconds - Seconds to rewind (default: 10)
   */
  rewindSeconds(seconds: number = 10): void {
    const currentTime = this.getVirtualElapsedSeconds();
    const targetTime = Math.max(0, currentTime - seconds);
    this.goToTime(targetTime);
  }

  /**
   * Forward by a specified number of seconds
   * @param seconds - Seconds to forward (default: 10)
   */
  forwardSeconds(seconds: number = 10): void {
    const currentTime = this.getVirtualElapsedSeconds();
    const targetTime = currentTime + seconds;
    this.goToTime(targetTime);
  }
}
