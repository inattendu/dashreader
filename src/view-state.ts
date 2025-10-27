/**
 * ViewState - Centralized reactive state manager for DashReader view
 *
 * Provides a single source of truth for all UI state, eliminating scattered
 * properties across the view class. Uses a simple event system for reactivity.
 */

type StateChangeListener = (key: string, value: any, oldValue: any) => void;

export interface ViewStateData {
  // Reading state
  wordsRead: number;
  startTime: number;

  // UI visibility state
  showingControls: boolean;
  showingSettings: boolean;
  showingStats: boolean;

  // Current values (mirrors settings but changes during runtime)
  currentWpm: number;
  currentChunkSize: number;
  currentFontSize: number;

  // Loading state
  isLoading: boolean;
  loadedFileName?: string;
  loadedLineNumber?: number;
}

export const DEFAULT_VIEW_STATE: ViewStateData = {
  wordsRead: 0,
  startTime: 0,
  showingControls: false,
  showingSettings: false,
  showingStats: false,
  currentWpm: 0,
  currentChunkSize: 0,
  currentFontSize: 0,
  isLoading: false,
};

/**
 * Reactive state container with event emission on changes
 */
export class ViewState {
  private state: ViewStateData;
  private listeners: Set<StateChangeListener> = new Set();

  constructor(initialState: Partial<ViewStateData> = {}) {
    this.state = { ...DEFAULT_VIEW_STATE, ...initialState };
  }

  /**
   * Get a state value
   */
  get<K extends keyof ViewStateData>(key: K): ViewStateData[K] {
    return this.state[key];
  }

  /**
   * Set a state value and notify listeners
   */
  set<K extends keyof ViewStateData>(key: K, value: ViewStateData[K]): void {
    const oldValue = this.state[key];
    if (oldValue === value) return; // No change, skip notification

    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  /**
   * Update multiple state values at once
   */
  update(updates: Partial<ViewStateData>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key as keyof ViewStateData, value);
    });
  }

  /**
   * Reset state to defaults
   */
  reset(): void {
    Object.entries(DEFAULT_VIEW_STATE).forEach(([key, value]) => {
      this.set(key as keyof ViewStateData, value);
    });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a state change
   */
  private notify(key: string, value: any, oldValue: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(key, value, oldValue);
      } catch (error) {
        console.error('DashReader: Error in state listener', error);
      }
    });
  }

  /**
   * Get all state as a plain object (for debugging)
   */
  getAll(): Readonly<ViewStateData> {
    return { ...this.state };
  }

  /**
   * Toggle a boolean state value
   */
  toggle(key: keyof Pick<ViewStateData, 'showingControls' | 'showingSettings' | 'showingStats' | 'isLoading'>): void {
    const currentValue = this.get(key);
    if (typeof currentValue === 'boolean') {
      this.set(key, !currentValue as any);
    }
  }

  /**
   * Increment a numeric state value
   */
  increment(key: keyof Pick<ViewStateData, 'wordsRead'>, delta: number = 1): void {
    const currentValue = this.get(key);
    if (typeof currentValue === 'number') {
      this.set(key, (currentValue + delta) as any);
    }
  }
}
