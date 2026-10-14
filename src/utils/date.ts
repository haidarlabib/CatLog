/**
 * Indonesian Date and Time Formatting Utilities
 * ProwlLog PWA
 */

/**
 * Format a timestamp into full Indonesian date and time format:
 * Example: "Selasa, 17 Februari 2026, 09.12"
 *
 * Requirements:
 * - Indonesian locale (id-ID)
 * - Full weekday name (e.g. Selasa)
 * - Numeric day of month (e.g. 17)
 * - Full month name (e.g. Februari)
 * - 4-digit year (e.g. 2026)
 * - 24-hour time format with dot separator (e.g. 09.12)
 * - No seconds
 */
export function formatIndonesianDateTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'object' && dateInput instanceof Date
    ? dateInput
    : new Date(dateInput);

  if (isNaN(date.getTime())) return '';

  const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const datePart = dateFormatter.format(date);
  // Indonesian standard typography uses dot separator for time (e.g., 09.12)
  const timePart = timeFormatter.format(date).replace(':', '.');

  return `${datePart}, ${timePart}`;
}
