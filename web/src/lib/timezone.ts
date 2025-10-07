/**
 * Timezone utilities for handling IST (Indian Standard Time)
 * IST is UTC+5:30
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date/time in IST
 */
export function getCurrentIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
}

/**
 * Convert a UTC date to IST
 */
export function utcToIST(utcDate: Date): Date {
  return new Date(utcDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
}

/**
 * Convert an IST date to UTC for database storage
 */
export function istToUTC(istDate: Date): Date {
  // Create a new date in IST timezone
  const istTime = new Date(istDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  // Get the timezone offset and adjust
  const offset = istTime.getTimezoneOffset() + (5.5 * 60); // IST is UTC+5:30
  return new Date(istTime.getTime() + (offset * 60 * 1000));
}

/**
 * Format a date for display in IST
 */
export function formatIST(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    ...options
  });
}

/**
 * Get IST date string for database operations
 */
export function getISTDateString(): string {
  return getCurrentIST().toISOString();
}

/**
 * Create a Prisma-compatible date that will be stored as IST
 * This ensures all database timestamps are in IST
 */
export function createISTDate(date?: Date): Date {
  if (!date) {
    return getCurrentIST();
  }
  return utcToIST(date);
}
