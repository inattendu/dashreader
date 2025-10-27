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
  wpm: 300,
  chunkSize: 1,
  fontSize: 48,
  highlightColor: '#4a9eff',
  backgroundColor: '#1e1e1e',
  fontColor: '#ffffff',
  fontFamily: 'inherit',
  showContext: true,
  contextWords: 3,
  enableMicropause: true,
  micropausePunctuation: 1.5,
  micropauseLongWords: 1.3,
  micropauseParagraph: 2.0,
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
  accelerationTargetWpm: 450
};

export interface WordChunk {
  text: string;
  index: number;
  delay: number;
  isEnd: boolean;
}

export interface ReadingStats {
  wordsRead: number;
  timeSpent: number;
  sessionsCount: number;
  averageWpm: number;
}
