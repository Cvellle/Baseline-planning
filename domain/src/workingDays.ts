/**
 * Working days = Monday..Friday. Public holidays are explicitly ignored
 * per the spec ("Working days are Monday to Friday — public holidays are
 * ignored entirely").
 */

/** Number of days in a given month (1-indexed month, JS Date trick). */
function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** Count Mon-Fri days in the given month. month1 is 1-indexed (1=Jan). */
export function getWorkingDaysInMonth(year: number, month1: number): number {
  const total = daysInMonth(year, month1);
  let count = 0;
  for (let day = 1; day <= total; day++) {
    const dow = new Date(year, month1 - 1, day).getDay(); // 0=Sun..6=Sat
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Count working days strictly before `cutoffDay` (i.e. days 1..cutoffDay-1),
 * and working days from `cutoffDay` to the end of month inclusive.
 * cutoffDay is 1-indexed day-of-month. validFrom is inclusive, so the
 * cutoff day itself belongs to the "on/after" bucket.
 */
export function splitWorkingDaysAtDay(
  year: number,
  month1: number,
  cutoffDay: number
): { before: number; onOrAfter: number } {
  const total = daysInMonth(year, month1);
  let before = 0;
  let onOrAfter = 0;
  for (let day = 1; day <= total; day++) {
    const dow = new Date(year, month1 - 1, day).getDay();
    if (dow === 0 || dow === 6) continue;
    if (day < cutoffDay) before++;
    else onOrAfter++;
  }
  return { before, onOrAfter };
}

/** Parse "YYYY-MM-DD" into {year, month1, day}. No timezone conversion. */
export function parseISODate(iso: string): { year: number; month1: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month1: m, day: d };
}

/** Parse "YYYY-MM" into {year, month1}. */
export function parseYearMonth(ym: string): { year: number; month1: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month1: m };
}

/** Compare two "YYYY-MM-DD" ISO date strings lexically (works because zero-padded). */
export function compareISODates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
