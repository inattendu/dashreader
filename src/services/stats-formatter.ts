/**
 * StatsFormatter - Formats reading statistics for display
 *
 * PURPOSE
 * ───────
 * Centralizes all statistics formatting logic in a reusable service.
 * Previously scattered across updateStats() and updateStatsDisplay() methods.
 *
 * RESPONSIBILITIES
 * ────────────────
 * - Format reading progress statistics (words, time, WPM)
 * - Generate stats text for different contexts (reading, loaded, ready)
 * - Consistent formatting across all display locations
 * - Reusable formatting functions for time and numbers
 *
 * USAGE
 * ─────
 * ```typescript
 * const formatter = new StatsFormatter();
 *
 * // During reading
 * const readingStats = formatter.formatReadingStats({
 *   wordsRead: 150,
 *   totalWords: 500,
 *   elapsedTime: 45,
 *   currentWpm: 200,
 *   remainingTime: 105
 * });
 * // "150/500 words | 0:45 | 200 WPM | 1:45 left"
 *
 * // After loading text
 * const loadedStats = formatter.formatLoadedStats({
 *   remainingWords: 500,
 *   totalWords: 500,
 *   estimatedDuration: 150,
 *   fileName: 'document.md'
 * });
 * // "500 words loaded from document.md - ~2:30 - Shift+Space to start"
 * ```
 */

/**
 * Statistics data for reading state
 */
export interface ReadingStats {
  /** Words read so far */
  wordsRead: number;
  /** Total words in document */
  totalWords: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Current reading speed in WPM */
  currentWpm: number;
  /** Estimated remaining time in seconds */
  remainingTime: number;
}

/**
 * Statistics data for loaded state
 */
export interface LoadedStats {
  /** Remaining words to read */
  remainingWords: number;
  /** Total words in document */
  totalWords: number;
  /** Estimated duration in seconds */
  estimatedDuration: number;
  /** Optional file name */
  fileName?: string;
  /** Optional starting word index (if resuming) */
  startWordIndex?: number;
}

/**
 * StatsFormatter service for consistent statistics formatting
 */
export class StatsFormatter {
  /**
   * Format time in seconds to MM:SS format
   *
   * @param seconds - Time in seconds
   * @returns Formatted time string (MM:SS)
   *
   * @example
   * ```typescript
   * formatTime(0);    // "0:00"
   * formatTime(45);   // "0:45"
   * formatTime(90);   // "1:30"
   * formatTime(3661); // "61:01"
   * ```
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format reading statistics for display during reading
   *
   * Shows: words read/total, elapsed time, current WPM, remaining time
   *
   * @param stats - Reading statistics
   * @returns Formatted stats string
   *
   * @example
   * ```typescript
   * formatReadingStats({
   *   wordsRead: 150,
   *   totalWords: 500,
   *   elapsedTime: 45,
   *   currentWpm: 200,
   *   remainingTime: 105
   * });
   * // Returns: "150/500 words | 0:45 | 200 WPM | 1:45 left"
   * ```
   */
  formatReadingStats(stats: ReadingStats): string {
    const { wordsRead, totalWords, elapsedTime, currentWpm, remainingTime } = stats;

    return [
      `${wordsRead}/${totalWords} words`,
      this.formatTime(elapsedTime),
      `${currentWpm} WPM`,
      `${this.formatTime(remainingTime)} left`
    ].join(' | ');
  }

  /**
   * Format loaded statistics for display after loading text
   *
   * Shows: words loaded, estimated duration, file info, instructions
   *
   * @param stats - Loaded statistics
   * @returns Formatted stats string
   *
   * @example
   * ```typescript
   * // From beginning
   * formatLoadedStats({
   *   remainingWords: 500,
   *   totalWords: 500,
   *   estimatedDuration: 150
   * });
   * // Returns: "500 words loaded - ~2:30 - Shift+Space to start"
   *
   * // From cursor position
   * formatLoadedStats({
   *   remainingWords: 300,
   *   totalWords: 500,
   *   estimatedDuration: 90,
   *   fileName: 'document.md',
   *   startWordIndex: 200
   * });
   * // Returns: "300/500 words loaded from document.md - ~1:30 - Shift+Space to start"
   * ```
   */
  formatLoadedStats(stats: LoadedStats): string {
    const { remainingWords, totalWords, estimatedDuration, fileName, startWordIndex } = stats;

    // Word count info
    const wordInfo = startWordIndex && startWordIndex > 0
      ? `${remainingWords}/${totalWords} words`
      : `${totalWords} words`;

    // File info
    const fileInfo = fileName ? ` from ${fileName}` : '';

    // Duration
    const durationText = this.formatTime(estimatedDuration);

    return `${wordInfo} loaded${fileInfo} - ~${durationText} - Shift+Space to start`;
  }

  /**
   * Format word count for display
   *
   * @param wordsRead - Words read so far
   * @param totalWords - Total words in document
   * @returns Formatted word count string
   *
   * @example
   * ```typescript
   * formatWordCount(150, 500);  // "150/500 words"
   * formatWordCount(0, 500);    // "0/500 words"
   * formatWordCount(500, 500);  // "500/500 words"
   * ```
   */
  formatWordCount(wordsRead: number, totalWords: number): string {
    return `${wordsRead}/${totalWords} words`;
  }

  /**
   * Format WPM (words per minute) for display
   *
   * @param wpm - Words per minute
   * @returns Formatted WPM string
   *
   * @example
   * ```typescript
   * formatWpm(200);  // "200 WPM"
   * formatWpm(350);  // "350 WPM"
   * ```
   */
  formatWpm(wpm: number): string {
    return `${wpm} WPM`;
  }
}
