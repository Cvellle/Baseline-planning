/**
 * Domain types. These are the minimum fields required by the spec (Fig. 2).
 * Both People and Delivery import this package — it is the one piece of
 * source they are allowed to share, because it is pure calculation logic
 * with no UI and no ownership of state.
 */

export interface Employee {
  id: string;
  name: string;
  role: string;
  /** 40, 32 or 20 */
  weeklyHours: number;
}

export interface RateRecord {
  id: string;
  employeeId: string;
  /** ISO date, e.g. "2026-03-12". Inclusive: the day itself uses this rate. */
  validFrom: string;
  hourlyCost: number;
}

export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface BreakdownItem {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
}

/**
 * Canonical stored unit for an allocation is HOURS.
 * The seed fixture expresses "amount" in person-months for readability;
 * loaders must convert seed amounts to hours before storing them
 * (see units.ts -> personMonthsToHours).
 */
export interface Allocation {
  id: string;
  breakdownItemId: string;
  employeeId: string;
  /** "YYYY-MM" */
  month: string;
  /** Canonical unit: hours */
  hours: number;
}

export type DisplayUnit = "hours" | "personMonths" | "percent" | "cost";

export interface RateSlice {
  /** Number of working days this slice covers within the month */
  workingDays: number;
  hourlyCost: number;
}

export interface MonthCostBreakdown {
  workingDaysInMonth: number;
  slices: RateSlice[];
  hoursPerWorkingDay: number;
  totalHours: number;
  totalCost: number;
  /** totalCost / totalHours. NaN-safe: 0 when totalHours is 0. */
  blendedRatePerHour: number;
  /** true when the month is entirely before the employee's first rate record */
  beforeFirstRate: boolean;
}
