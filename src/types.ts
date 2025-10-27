export interface DashReaderSettings {
  wpm: number;
  chunkSize: number;
  fontSize: number;
  highlightColor: string;
  backgroundColor: string;
  fontColor: string;
  fontFamily: string;
  showContext: boolean;
  contextWords: number;
  enableMicropause: boolean;
  micropausePunctuation: number;
  micropauseLongWords: number;
  micropauseParagraph: number;
  autoStart: boolean;
  autoStartDelay: number;
  showProgress: boolean;
  showStats: boolean;
  hotkeyPlay: string;
  hotkeyRewind: string;
  hotkeyForward: string;
  hotkeyIncrementWpm: string;
  hotkeyDecrementWpm: string;
  hotkeyQuit: string;
  enableAcceleration: boolean;
  accelerationDuration: number;
  accelerationTargetWpm: number;
}

export const DEFAULT_SETTINGS: DashReaderSettings = {
  wpm: 400, // Increased from 300 (inspired by Stutter: 400-800 range)
  chunkSize: 1,
  fontSize: 48,
  highlightColor: '#4a9eff',
  backgroundColor: '#1e1e1e',
  fontColor: '#ffffff',
  fontFamily: 'inherit',
  showContext: true,
  contextWords: 3,
  enableMicropause: true,
  micropausePunctuation: 2.5, // Increased from 1.5 (Stutter: 2.5 for sentences)
  micropauseLongWords: 1.4, // Increased from 1.3 (Stutter: 1.4)
  micropauseParagraph: 2.5, // Increased from 2.0 for better section separation
  autoStart: false,
  autoStartDelay: 3,
  showProgress: true,
  showStats: true,
  hotkeyPlay: 'Space',
  hotkeyRewind: 'ArrowLeft',
  hotkeyForward: 'ArrowRight',
  hotkeyIncrementWpm: 'ArrowUp',
  hotkeyDecrementWpm: 'ArrowDown',
  hotkeyQuit: 'Escape',
  enableAcceleration: false,
  accelerationDuration: 30,
  accelerationTargetWpm: 600 // Increased from 450 (Stutter suggests 600-800)
};

export interface HeadingInfo {
  /** Heading level (1-6), or 0 for callouts */
  level: number;
  /** Heading text (without [H1] or [CALLOUT:type] marker) */
  text: string;
  /** Word index where this heading appears */
  wordIndex: number;
  /** Callout type if this is a callout (note, abstract, info, etc.) */
  calloutType?: string;
}

export interface HeadingContext {
  /** Breadcrumb path from H1 to current heading */
  breadcrumb: HeadingInfo[];
  /** Current heading (last item in breadcrumb) */
  current: HeadingInfo | null;
}

export interface WordChunk {
  text: string;
  index: number;
  delay: number;
  isEnd: boolean;
  /** Current heading context (breadcrumb) - optional */
  headingContext?: HeadingContext;
}

export interface ReadingStats {
  wordsRead: number;
  timeSpent: number;
  sessionsCount: number;
  averageWpm: number;
}
