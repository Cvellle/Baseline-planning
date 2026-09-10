import { Allocation } from "./types.js";
import { personMonthHours } from "./rates.js";

export interface CapacityResult {
  totalAllocatedHours: number;
  capacityHours: number;
  isOverCapacity: boolean;
  /** id of the most recently edited allocation contributing to this month (R5) */
  causingAllocationId: string | null;
}

/**
 * Capacity is cross-project (R5): sum every allocation for this employee in
 * this month across ALL breakdown items / projects, including ones not
 * currently open in the UI, and compare against 100% of that person's
 * person-month for that month.
 *
 * `updatedAt` lets us name "the most recently edited allocation" when
 * flagging an over-capacity month; pass an ISO timestamp or a monotonic
 * counter per allocation from your store.
 */
export function checkCapacity(
  employeeWeeklyHours: number,
  workingDaysInMonth: number,
  allocationsForEmployeeThisMonth: (Allocation & { updatedAt?: string | number })[]
): CapacityResult {
  const capacityHours = personMonthHours(employeeWeeklyHours, workingDaysInMonth);
  const totalAllocatedHours = allocationsForEmployeeThisMonth.reduce((sum, a) => sum + a.hours, 0);

  let causingAllocationId: string | null = null;
  if (allocationsForEmployeeThisMonth.length > 0) {
    const mostRecent = [...allocationsForEmployeeThisMonth].sort((a, b) => {
      const av = a.updatedAt ?? "";
      const bv = b.updatedAt ?? "";
      return av > bv ? -1 : av < bv ? 1 : 0;
    })[0];
    causingAllocationId = mostRecent.id;
  }

  return {
    totalAllocatedHours,
    capacityHours,
    isOverCapacity: totalAllocatedHours > capacityHours + 1e-9,
    causingAllocationId,
  };
}
