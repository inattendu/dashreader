/**
 * MicropauseService - Calculates reading delay multipliers based on word characteristics
 *
 * PURPOSE
 * ───────
 * Centralizes micropause logic using Strategy Pattern to eliminate duplication.
 * Previously duplicated across calculateDelay() and calculateAccurateRemainingTime().
 *
 * ARCHITECTURE
 * ────────────
 * Uses Strategy Pattern:
 * - Each micropause type is a strategy with getMultiplier(word) method
 * - MicropauseService orchestrates all strategies
 * - Multipliers stack multiplicatively (heading + punctuation + long word = 2.0 * 2.5 * 1.4)
 *
 * MICROPAUSE TYPES
 * ────────────────
 * 1. Headings [H1-H6] - Visual hierarchy (H1=2.0x, H2=1.8x, H3=1.5x, etc.)
 * 2. Callouts [CALLOUT:type] - Obsidian callout blocks
 * 3. Section markers (1., I., II., a.) - Enumeration starts
 * 4. List bullets (-, *, +, •) - List item markers
 * 5. Sentence punctuation (.,!?) - Full stops
 * 6. Other punctuation (;:,) - Lighter pauses
 * 7. Numbers (contains digits) - Dates, stats, years
 * 8. Long words (>8 chars) - Complex words need more time
 * 9. Paragraph breaks (\n) - Section separators
 *
 * USAGE
 * ─────
 * ```typescript
 * const service = new MicropauseService(settings);
 * const multiplier = service.calculateMultiplier("Hello!");
 * const delay = baseDelay * multiplier;
 * ```
 */

import { DashReaderSettings } from '../types';

/**
 * Strategy interface for micropause calculation
 */
interface MicropauseStrategy {
  /**
   * Calculates the delay multiplier for a given word
   * @param word - The word to analyze
   * @returns Multiplier (1.0 = no pause, >1.0 = longer pause)
   */
  getMultiplier(word: string): number;
}

/**
 * Strategy for heading markers [H1], [H2], etc.
 * Hardcoded multipliers for visual hierarchy
 */
class HeadingStrategy implements MicropauseStrategy {
  private static readonly MULTIPLIERS = [0, 2.0, 1.8, 1.5, 1.3, 1.2, 1.1];

  getMultiplier(word: string): number {
    const trimmed = word.trim();
    const match = trimmed.match(/^\[H(\d)\]/);
    if (!match) return 1.0;

    const level = parseInt(match[1]);
    return HeadingStrategy.MULTIPLIERS[level] || 1.5;
  }
}

/**
 * Strategy for Obsidian callouts [CALLOUT:type]
 */
class CalloutStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    const trimmed = word.trim();
    return /^\[CALLOUT:[\w-]+\]/.test(trimmed) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for section markers (1., 2., I., II., a., etc.)
 */
class SectionMarkerStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    const trimmed = word.trim();
    return /^(\d+\.|[IVXLCDM]+\.|\w\.)/.test(trimmed) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for list bullets (-, *, +, •)
 */
class ListBulletStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    const trimmed = word.trim();
    return /^[-*+•]/.test(trimmed) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for sentence-ending punctuation (.,!?)
 */
class SentencePunctuationStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    return /[.!?]$/.test(word) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for other punctuation (;:,)
 */
class OtherPunctuationStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    return /[;:,]$/.test(word) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for words containing numbers
 */
class NumberStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    return /\d/.test(word) ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for long words (>8 characters)
 */
class LongWordStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    return word.length > 8 ? this.multiplier : 1.0;
  }
}

/**
 * Strategy for paragraph breaks (line breaks)
 */
class ParagraphBreakStrategy implements MicropauseStrategy {
  constructor(private multiplier: number) {}

  getMultiplier(word: string): number {
    return word.includes('\n') ? this.multiplier : 1.0;
  }
}

/**
 * MicropauseService orchestrates all micropause strategies
 */
export class MicropauseService {
  private strategies: MicropauseStrategy[];
  private enabled: boolean;

  constructor(settings: DashReaderSettings) {
    this.enabled = settings.enableMicropause;

    // Initialize all strategies in detection order
    // Order matters: headings first, then callouts, then markers, etc.
    this.strategies = [
      new HeadingStrategy(),
      new CalloutStrategy(settings.micropauseCallouts),
      new SectionMarkerStrategy(settings.micropauseSectionMarkers),
      new ListBulletStrategy(settings.micropauseListBullets),
      new SentencePunctuationStrategy(settings.micropausePunctuation),
      new OtherPunctuationStrategy(settings.micropauseOtherPunctuation),
      new NumberStrategy(settings.micropauseNumbers),
      new LongWordStrategy(settings.micropauseLongWords),
      new ParagraphBreakStrategy(settings.micropauseParagraph)
    ];
  }

  /**
   * Calculates the total multiplier for a word
   * Applies all strategies and multiplies the results
   *
   * @param word - The word to analyze
   * @returns Total multiplier (1.0 = no pause, >1.0 = longer pause)
   *
   * @example
   * ```typescript
   * const service = new MicropauseService(settings);
   *
   * service.calculateMultiplier("Hello");     // 1.0 (no special characteristics)
   * service.calculateMultiplier("Hello!");    // 2.5 (sentence punctuation)
   * service.calculateMultiplier("[H1]Title"); // 2.0 (heading)
   * service.calculateMultiplier("Hello!\n");  // 6.25 (2.5 * 2.5 = punctuation * paragraph)
   * ```
   */
  calculateMultiplier(word: string): number {
    if (!this.enabled) return 1.0;

    let totalMultiplier = 1.0;

    // Apply all strategies multiplicatively
    for (const strategy of this.strategies) {
      const strategyMultiplier = strategy.getMultiplier(word);
      totalMultiplier *= strategyMultiplier;
    }

    return totalMultiplier;
  }

  /**
   * Updates service with new settings
   * Recreates strategies with updated multipliers
   *
   * @param settings - New settings
   */
  updateSettings(settings: DashReaderSettings): void {
    this.enabled = settings.enableMicropause;

    // Recreate strategies with new multipliers
    this.strategies = [
      new HeadingStrategy(),
      new CalloutStrategy(settings.micropauseCallouts),
      new SectionMarkerStrategy(settings.micropauseSectionMarkers),
      new ListBulletStrategy(settings.micropauseListBullets),
      new SentencePunctuationStrategy(settings.micropausePunctuation),
      new OtherPunctuationStrategy(settings.micropauseOtherPunctuation),
      new NumberStrategy(settings.micropauseNumbers),
      new LongWordStrategy(settings.micropauseLongWords),
      new ParagraphBreakStrategy(settings.micropauseParagraph)
    ];
  }
}
