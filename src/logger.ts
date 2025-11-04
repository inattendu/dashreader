/**
 * Simple conditional logger for DashReader
 *
 * In production: only errors are logged
 * In debug mode: all logs are shown
 */

const DEBUG = false; // Set to true for development debugging

export class Logger {
  private static prefix = 'DashReader:';

  /**
   * Log debug information (only in debug mode)
   */
  static debug(...args: unknown[]): void {
    if (DEBUG) {
      console.debug(this.prefix, ...args);
    }
  }

  /**
   * Log warnings (only in debug mode)
   */
  static warn(...args: unknown[]): void {
    if (DEBUG) {
      console.warn(this.prefix, ...args);
    }
  }

  /**
   * Log errors (always shown)
   */
  static error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }
}
