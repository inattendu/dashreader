/**
 * @file view-state.ts
 * @description ViewState - Centralized reactive state manager for DashReader view
 *
 * PURPOSE
 * ───────
 * Provides a single source of truth for all UI state, eliminating scattered
 * properties across the view class. Uses a simple event system for reactivity
 * without requiring external libraries like Redux or MobX.
 *
 * **Problem Solved**: Before extraction, rsvp-view.ts had 15+ scattered state
 * properties (isLoading, showingControls, currentWpm, etc.) spread throughout
 * the class. This made state management difficult to track and debug.
 *
 * **Solution**: Centralize all state in one place with:
 * - Type-safe access via generics
 * - Event-based reactivity (observer pattern)
 * - Batch updates
 * - Helper methods (toggle, increment)
 *
 * ARCHITECTURE
 * ────────────
 * **Reactive State Pattern**:
 * - State changes trigger listener callbacks automatically
 * - Listeners can update UI in response to state changes
 * - No manual DOM manipulation needed in state updates
 *
 * **State Categories**:
 * 1. **Reading State**: wordsRead, startTime (track progress)
 * 2. **UI Visibility**: showingControls, showingSettings, showingStats
 * 3. **Current Values**: currentWpm, currentChunkSize, currentFontSize (runtime changes)
 * 4. **Loading State**: isLoading, loadedFileName, loadedLineNumber
 *
 * **Integration with View**:
 * ```typescript
 * // In rsvp-view.ts
 * this.viewState = new ViewState({ currentWpm: this.settings.wpm });
 * this.viewState.subscribe((key, value) => {
 *   if (key === 'showingControls') {
 *     this.dom.toggleClass('controlsEl', CSS_CLASSES.hidden, !value);
 *   }
 * });
 * ```
 *
 * OUTLINE
 * ───────
 * ├─ 1. TYPES & INTERFACES
 * │  ├─ StateChangeListener - Callback type for state changes
 * │  ├─ ViewStateData - State shape interface
 * │  └─ DEFAULT_VIEW_STATE - Initial state values
 * └─ 2. VIEWSTATE CLASS
 *    ├─ constructor() - Initialize with optional state
 *    ├─ get() - Type-safe state value getter
 *    ├─ set() - Type-safe setter with change notification
 *    ├─ update() - Batch update multiple values
 *    ├─ reset() - Reset to defaults
 *    ├─ subscribe() - Register listener, returns unsubscribe function
 *    ├─ notify() - Internal: Trigger all listeners
 *    ├─ getAll() - Debug accessor for full state
 *    ├─ toggle() - Helper for boolean values
 *    └─ increment() - Helper for numeric values
 *
 * @version 1.3.1
 * @author DashReader Team
 */

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

/**
 * State change listener callback
 *
 * Called whenever a state value changes via set() or update().
 *
 * @param key - Name of the state property that changed
 * @param value - New value of the property
 * @param oldValue - Previous value of the property
 */
type StateChangeListener = (key: string, value: any, oldValue: any) => void;

/**
 * ViewState data interface - Shape of all view state
 *
 * Centralized state shape replacing 15+ scattered properties in rsvp-view.ts.
 */
export interface ViewStateData {
  // ──────────────────────────────────────────────────────────────────────────
  // Reading State
  // ──────────────────────────────────────────────────────────────────────────

  /** Number of words read in current session */
  wordsRead: number;

  /** Timestamp when reading started (milliseconds since epoch) */
  startTime: number;

  // ──────────────────────────────────────────────────────────────────────────
  // UI Visibility State
  // ──────────────────────────────────────────────────────────────────────────

  /** Whether control panel is visible */
  showingControls: boolean;

  /** Whether settings panel is visible */
  showingSettings: boolean;

  /** Whether statistics panel is visible */
  showingStats: boolean;

  // ──────────────────────────────────────────────────────────────────────────
  // Current Values (Runtime)
  // ──────────────────────────────────────────────────────────────────────────

  /** Current WPM (can differ from settings during acceleration) */
  currentWpm: number;

  /** Current chunk size (mirrors settings.chunkSize) */
  currentChunkSize: number;

  /** Current font size (mirrors settings.fontSize) */
  currentFontSize: number;

  // ──────────────────────────────────────────────────────────────────────────
  // Loading State
  // ──────────────────────────────────────────────────────────────────────────

  /** Whether content is currently being loaded */
  isLoading: boolean;

  /** Name of the currently loaded file (optional) */
  loadedFileName?: string;

  /** Line number where loaded content started (optional, for selections) */
  loadedLineNumber?: number;
}

/**
 * Default initial state values
 *
 * Used to initialize ViewState and reset state to defaults.
 */
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

// ============================================================================
// 2. VIEWSTATE CLASS
// ============================================================================

/**
 * Reactive state container with event emission on changes
 *
 * Provides a centralized, type-safe state management solution using the
 * observer pattern. State changes automatically notify all subscribed listeners.
 *
 * **Key Features**:
 * - Type-safe getters and setters via generics
 * - Automatic change detection (skips notification if value unchanged)
 * - Subscribe/unsubscribe pattern for reactivity
 * - Batch updates via update() method
 * - Helper methods for common operations (toggle, increment)
 *
 * **Example Usage**:
 * ```typescript
 * // Initialize
 * const state = new ViewState({ currentWpm: 300 });
 *
 * // Subscribe to changes
 * state.subscribe((key, value, oldValue) => {
 *   console.log(`${key} changed from ${oldValue} to ${value}`);
 * });
 *
 * // Update state
 * state.set('currentWpm', 350); // Triggers listener
 * state.toggle('showingControls'); // Toggle boolean
 * state.increment('wordsRead', 5); // Add 5 to wordsRead
 * ```
 */
export class ViewState {
  private state: ViewStateData;
  private listeners: Set<StateChangeListener> = new Set();

  /**
   * Creates a new ViewState instance
   *
   * @param initialState - Optional partial state to merge with defaults
   *
   * @example
   * ```typescript
   * // Default state
   * const state = new ViewState();
   *
   * // With initial values
   * const state = new ViewState({
   *   currentWpm: 300,
   *   showingControls: true
   * });
   * ```
   */
  constructor(initialState: Partial<ViewStateData> = {}) {
    this.state = { ...DEFAULT_VIEW_STATE, ...initialState };
  }

  /**
   * Get a state value (type-safe)
   *
   * Uses TypeScript generics to ensure return type matches the requested key.
   *
   * @param key - State property to get
   * @returns Current value of the property
   *
   * @example
   * ```typescript
   * const wpm: number = state.get('currentWpm');
   * const showing: boolean = state.get('showingControls');
   * ```
   */
  get<K extends keyof ViewStateData>(key: K): ViewStateData[K] {
    return this.state[key];
  }

  /**
   * Set a state value and notify listeners (type-safe)
   *
   * Updates the state property and notifies all subscribers if the value changed.
   * Automatically skips notification if the new value equals the old value.
   *
   * @param key - State property to set
   * @param value - New value for the property
   *
   * @example
   * ```typescript
   * state.set('currentWpm', 350);
   * state.set('showingControls', true);
   * state.set('loadedFileName', 'My Note.md');
   * ```
   */
  set<K extends keyof ViewStateData>(key: K, value: ViewStateData[K]): void {
    const oldValue = this.state[key];
    if (oldValue === value) return; // No change, skip notification

    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  /**
   * Update multiple state values at once (batch update)
   *
   * Efficiently updates multiple properties in a single call. Each changed
   * property will trigger its own notification to listeners.
   *
   * @param updates - Partial state object with properties to update
   *
   * @example
   * ```typescript
   * state.update({
   *   currentWpm: 350,
   *   showingControls: true,
   *   wordsRead: 42
   * });
   * ```
   */
  update(updates: Partial<ViewStateData>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key as keyof ViewStateData, value);
    });
  }

  /**
   * Reset all state to default values
   *
   * Sets every state property back to its default value from DEFAULT_VIEW_STATE.
   * Each reset property triggers a notification to listeners.
   *
   * @example
   * ```typescript
   * // After reading session, reset to defaults
   * state.reset();
   * ```
   */
  reset(): void {
    Object.entries(DEFAULT_VIEW_STATE).forEach(([key, value]) => {
      this.set(key as keyof ViewStateData, value);
    });
  }

  /**
   * Subscribe to state changes (observer pattern)
   *
   * Registers a listener function that will be called whenever any state
   * property changes. Returns an unsubscribe function for cleanup.
   *
   * **Error Handling**: Listener errors are caught and logged to prevent
   * one broken listener from breaking all listeners.
   *
   * @param listener - Callback function to call on state changes
   * @returns Unsubscribe function to remove the listener
   *
   * @example
   * ```typescript
   * // Subscribe and get unsubscribe function
   * const unsubscribe = state.subscribe((key, value, oldValue) => {
   *   if (key === 'currentWpm') {
   *     console.log(`WPM changed from ${oldValue} to ${value}`);
   *   }
   * });
   *
   * // Later, cleanup
   * unsubscribe();
   * ```
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a state change (internal)
   *
   * Calls each registered listener with the changed property details.
   * Catches and logs errors to prevent one broken listener from affecting others.
   *
   * @param key - Name of the property that changed
   * @param value - New value of the property
   * @param oldValue - Previous value of the property
   *
   * @private
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
   *
   * Returns a shallow copy of the entire state object. Useful for logging
   * or debugging state issues.
   *
   * @returns Readonly copy of the full state
   *
   * @example
   * ```typescript
   * console.log('Current state:', state.getAll());
   * // Output: { wordsRead: 42, currentWpm: 350, showingControls: true, ... }
   * ```
   */
  getAll(): Readonly<ViewStateData> {
    return { ...this.state };
  }

  /**
   * Toggle a boolean state value (helper)
   *
   * Convenience method for toggling boolean properties. Flips the value
   * from true to false or false to true.
   *
   * @param key - Boolean property to toggle (showingControls, showingSettings, showingStats, isLoading)
   *
   * @example
   * ```typescript
   * // Toggle control panel visibility
   * state.toggle('showingControls');
   *
   * // Toggle settings panel
   * state.toggle('showingSettings');
   * ```
   */
  toggle<K extends 'showingControls' | 'showingSettings' | 'showingStats' | 'isLoading'>(key: K): void {
    const currentValue = this.get(key) as boolean;
    this.set(key, !currentValue);
  }

  /**
   * Increment a numeric state value (helper)
   *
   * Convenience method for incrementing numeric properties. Can add positive
   * or negative deltas.
   *
   * @param key - Numeric property to increment (currently only wordsRead)
   * @param delta - Amount to add (default: 1, can be negative)
   *
   * @example
   * ```typescript
   * // Increment words read by 1
   * state.increment('wordsRead');
   *
   * // Increment by 5
   * state.increment('wordsRead', 5);
   *
   * // Decrement by 1
   * state.increment('wordsRead', -1);
   * ```
   */
  increment<K extends 'wordsRead'>(key: K, delta: number = 1): void {
    const currentValue = this.get(key) as number;
    this.set(key, currentValue + delta);
  }
}
