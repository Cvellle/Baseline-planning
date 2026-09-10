import { RateRecord, RateSlice, MonthCostBreakdown } from "./types.js";
import {
  getWorkingDaysInMonth,
  splitWorkingDaysAtDay,
  parseISODate,
  parseYearMonth,
  compareISODates,
} from "./workingDays.js";

/**
 * One person-month = weeklyHours * (workingDaysInMonth / 5).
 * This is NOT a constant — it depends on the person's weekly hours AND
 * on how many working days that specific month has.
 */
export function personMonthHours(weeklyHours: number, workingDaysInMonth: number): number {
  return weeklyHours * (workingDaysInMonth / 5);
}

/**
 * Split a calendar month into rate "slices" using an employee's full rate
 * history. A rate applies from its validFrom (inclusive) until the next
 * record's validFrom begins; the last record has no end date.
 *
 * Returns slices in chronological order, each carrying the number of
 * working days (within this month) that fall under that rate.
 */
function computeRateSlices(
  rates: RateRecord[],
  year: number,
  month1: number
): { slices: RateSlice[]; beforeFirstRate: boolean } {
  const sorted = [...rates].sort((a, b) => compareISODates(a.validFrom, b.validFrom));

  if (sorted.length === 0) {
    return { slices: [], beforeFirstRate: true };
  }

  const workingDaysInMonth = getWorkingDaysInMonth(year, month1);
  const monthStart = `${year}-${String(month1).padStart(2, "0")}-01`;
  const monthEndDay = new Date(year, month1, 0).getDate();
  const monthEnd = `${year}-${String(month1).padStart(2, "0")}-${String(monthEndDay).padStart(2, "0")}`;

  // Entirely before the first ever rate record -> zero cost, flagged.
  if (compareISODates(monthEnd, sorted[0].validFrom) < 0) {
    return { slices: [], beforeFirstRate: true };
  }

  // Find every rate-change boundary that falls strictly inside this month
  // (validFrom > monthStart and <= monthEnd), in order.
  const boundariesInMonth = sorted
    .filter((r) => compareISODates(r.validFrom, monthStart) > 0 && compareISODates(r.validFrom, monthEnd) <= 0)
    .map((r) => parseISODate(r.validFrom).day);

  // The rate active at the very start of the month is the last record
  // whose validFrom <= monthStart.
  const activeAtStart = [...sorted].reverse().find((r) => compareISODates(r.validFrom, monthStart) <= 0);

  // Build the ordered list of {fromDay, hourlyCost} cut points, starting at day 1.
  const cutPoints: { fromDay: number; hourlyCost: number }[] = [];
  if (activeAtStart) {
    cutPoints.push({ fromDay: 1, hourlyCost: activeAtStart.hourlyCost });
  }
  for (const day of boundariesInMonth) {
    const record = sorted.find((r) => parseISODate(r.validFrom).day === day && parseYearMonth(`${year}-${String(month1).padStart(2, "0")}`).month1 === month1);
    if (record) cutPoints.push({ fromDay: day, hourlyCost: record.hourlyCost });
  }

  // De-dupe consecutive same-day entries (defensive) and convert to slices
  // of working days using splitWorkingDaysAtDay pairwise.
  const slices: RateSlice[] = [];
  for (let i = 0; i < cutPoints.length; i++) {
    const startDay = cutPoints[i].fromDay;
    const endDayExclusive = i + 1 < cutPoints.length ? cutPoints[i + 1].fromDay : monthEndDay + 1;
    const { before: beforeStart } = splitWorkingDaysAtDay(year, month1, startDay);
    const { before: beforeEnd } = splitWorkingDaysAtDay(year, month1, endDayExclusive);
    const workingDays = beforeEnd - beforeStart;
    if (workingDays > 0) {
      slices.push({ workingDays, hourlyCost: cutPoints[i].hourlyCost });
    }
  }

  return { slices, beforeFirstRate: false };
}

/**
 * Full R1-style breakdown for one employee, one month, one allocation
 * amount expressed in HOURS (the canonical unit).
 */
export function computeMonthCost(
  weeklyHours: number,
  rates: RateRecord[],
  year: number,
  month1: number,
  allocationHours: number
): MonthCostBreakdown {
  const workingDaysInMonth = getWorkingDaysInMonth(year, month1);
  const { slices, beforeFirstRate } = computeRateSlices(rates, year, month1);

  if (beforeFirstRate || workingDaysInMonth === 0) {
    return {
      workingDaysInMonth,
      slices: [],
      hoursPerWorkingDay: 0,
      totalHours: allocationHours,
      totalCost: 0,
      blendedRatePerHour: 0,
      beforeFirstRate: true,
    };
  }

  const hoursPerWorkingDay = allocationHours / workingDaysInMonth;
  const totalCost = slices.reduce(
    (sum, slice) => sum + slice.workingDays * hoursPerWorkingDay * slice.hourlyCost,
    0
  );
  const blendedRatePerHour = allocationHours === 0 ? 0 : totalCost / allocationHours;

  return {
    workingDaysInMonth,
    slices,
    hoursPerWorkingDay,
    totalHours: allocationHours,
    totalCost,
    blendedRatePerHour,
    beforeFirstRate: false,
  };
}
