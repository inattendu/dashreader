/**
 * TimeoutManager - Centralized timeout and interval management
 *
 * PURPOSE
 * ───────
 * Prevents memory leaks by tracking all timeouts and intervals,
 * allowing cleanup on component destruction.
 *
 * PROBLEM SOLVED
 * ──────────────
 * Before: Scattered setTimeout/setInterval calls throughout the codebase
 * with no cleanup mechanism. If a component is destroyed while a timeout
 * is pending, it can cause memory leaks and unexpected behavior.
 *
 * SOLUTION
 * ────────
 * Centralized service that tracks all active timers and provides
 * a clearAll() method for cleanup during component destruction.
 *
 * USAGE
 * ─────
 * ```typescript
 * class MyComponent {
 *   private timeoutManager = new TimeoutManager();
 *
 *   doSomethingLater() {
 *     this.timeoutManager.setTimeout(() => {
 *       console.log('Executed!');
 *     }, 1000);
 *   }
 *
 *   destroy() {
 *     this.timeoutManager.clearAll(); // Cleanup all pending timers
 *   }
 * }
 * ```
 *
 * @version 2.0.0
 * @author DashReader Team
 */

export class TimeoutManager {
  private timeouts = new Map<number, number>();
  private intervals = new Map<number, number>();

  /**
   * Create a timeout that will be automatically tracked
   *
   * @param callback - Function to execute after delay
   * @param delay - Delay in milliseconds
   * @returns Timeout ID (can be used with clearTimeout)
   *
   * @example
   * ```typescript
   * const id = this.timeoutManager.setTimeout(() => {
   *   console.log('Hello!');
   * }, 1000);
   * ```
   */
  setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      callback();
      this.timeouts.delete(id);
    }, delay);
    this.timeouts.set(id, id);
    return id;
  }

  /**
   * Create an interval that will be automatically tracked
   *
   * @param callback - Function to execute repeatedly
   * @param delay - Delay between executions in milliseconds
   * @returns Interval ID (can be used with clearInterval)
   *
   * @example
   * ```typescript
   * const id = this.timeoutManager.setInterval(() => {
   *   console.log('Tick');
   * }, 1000);
   * ```
   */
  setInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay);
    this.intervals.set(id, id);
    return id;
  }

  /**
   * Clear a specific timeout
   *
   * @param id - Timeout ID returned by setTimeout
   *
   * @example
   * ```typescript
   * const id = this.timeoutManager.setTimeout(...);
   * this.timeoutManager.clearTimeout(id); // Cancel it
   * ```
   */
  clearTimeout(id: number): void {
    window.clearTimeout(id);
    this.timeouts.delete(id);
  }

  /**
   * Clear a specific interval
   *
   * @param id - Interval ID returned by setInterval
   *
   * @example
   * ```typescript
   * const id = this.timeoutManager.setInterval(...);
   * this.timeoutManager.clearInterval(id); // Stop it
   * ```
   */
  clearInterval(id: number): void {
    window.clearInterval(id);
    this.intervals.delete(id);
  }

  /**
   * Clear all pending timeouts and intervals
   *
   * IMPORTANT: Call this in your component's destroy/cleanup method
   * to prevent memory leaks.
   *
   * @example
   * ```typescript
   * destroy() {
   *   this.timeoutManager.clearAll();
   * }
   * ```
   */
  clearAll(): void {
    // Clear all timeouts
    this.timeouts.forEach(id => window.clearTimeout(id));
    this.timeouts.clear();

    // Clear all intervals
    this.intervals.forEach(id => window.clearInterval(id));
    this.intervals.clear();
  }

  /**
   * Get the number of active timers (for debugging/testing)
   *
   * @returns Number of active timeouts + intervals
   *
   * @example
   * ```typescript
   * console.log(`Active timers: ${this.timeoutManager.activeCount}`);
   * ```
   */
  get activeCount(): number {
    return this.timeouts.size + this.intervals.size;
  }

  /**
   * Get the number of active timeouts only (for debugging/testing)
   */
  get activeTimeouts(): number {
    return this.timeouts.size;
  }

  /**
   * Get the number of active intervals only (for debugging/testing)
   */
  get activeIntervals(): number {
    return this.intervals.size;
  }
}
