import { describe, it, expect } from "vitest";
import { computeMonthCost } from "../src/rates.js";
import { personMonthHours } from "../src/rates.js";
import { getWorkingDaysInMonth } from "../src/workingDays.js";
import { hoursToUnit, roundForDisplay } from "../src/units.js";
import { largestRemainderRound } from "../src/rounding.js";
import { RateRecord } from "../src/types.js";

/**
 * Reference calculation from the spec (Fig. 4):
 *
 *  A. Okafor, 40 h/week. Rates €80.00/h from 2025-01-01 and €95.00/h from
 *  2026-03-12. One leaf cell of 0.50 person-months in March 2026.
 *
 *  March 2026 working days:        22
 *  Working days before 12 Mar:      8
 *  Working days from 12 Mar on:    14
 *  One person-month:               40 * 22 / 5 = 176.00 h
 *  This allocation in hours:       0.50 * 176 = 88.00 h
 *  Hours per working day:          88 / 22 = 4.00 h
 *  Cost:                           8*4*80 + 14*4*95 = 2560 + 5320 = 7880.00
 *  Same cell in % of capacity:     50.0%
 *  Implied blended rate:           89.5455 €/h
 */
describe("R1 reference calculation (A. Okafor, March 2026)", () => {
  const okaforRates: RateRecord[] = [
    { id: "rate-001", employeeId: "emp-001", validFrom: "2025-01-01", hourlyCost: 80.0 },
    { id: "rate-002", employeeId: "emp-001", validFrom: "2026-03-12", hourlyCost: 95.0 },
  ];
  const weeklyHours = 40;
  const year = 2026;
  const month1 = 3; // March

  it("March 2026 has 22 working days", () => {
    expect(getWorkingDaysInMonth(year, month1)).toBe(22);
  });

  it("one person-month for A. Okafor in March 2026 is 176.00 hours", () => {
    const workingDays = getWorkingDaysInMonth(year, month1);
    expect(personMonthHours(weeklyHours, workingDays)).toBeCloseTo(176.0, 6);
  });

  it("produces the exact slices, cost, percent and blended rate from Fig. 4", () => {
    const workingDays = getWorkingDaysInMonth(year, month1);
    const pmHours = personMonthHours(weeklyHours, workingDays);
    const allocationHours = 0.5 * pmHours; // 0.50 person-months -> hours

    expect(allocationHours).toBeCloseTo(88.0, 6);

    const breakdown = computeMonthCost(weeklyHours, okaforRates, year, month1, allocationHours);

    // Two slices: 8 days @ €80, 14 days @ €95
    expect(breakdown.slices).toHaveLength(2);
    expect(breakdown.slices[0]).toEqual({ workingDays: 8, hourlyCost: 80 });
    expect(breakdown.slices[1]).toEqual({ workingDays: 14, hourlyCost: 95 });

    expect(breakdown.hoursPerWorkingDay).toBeCloseTo(4.0, 6);
    expect(breakdown.totalCost).toBeCloseTo(7880.0, 2);

    const percent = hoursToUnit(allocationHours, "percent", {
      weeklyHours,
      workingDaysInMonth: workingDays,
    });
    expect(roundForDisplay(percent, "percent")).toBe(50.0);

    expect(roundForDisplay(breakdown.blendedRatePerHour, "cost")).toBeCloseTo(89.55, 1);
    // spec shows 4dp for the blended rate specifically
    expect(Number(breakdown.blendedRatePerHour.toFixed(4))).toBe(89.5455);
  });

  it("an allocation in a month before the employee's first rate record costs zero and is flagged", () => {
    const breakdown = computeMonthCost(weeklyHours, okaforRates, 2024, 6, 80);
    expect(breakdown.beforeFirstRate).toBe(true);
    expect(breakdown.totalCost).toBe(0);
  });

  it("switching a value to a unit and back does not change the stored value", () => {
    const workingDays = getWorkingDaysInMonth(year, month1);
    const ctx = { weeklyHours, workingDaysInMonth: workingDays };
    const originalHours = 88.0;

    const asPercent = hoursToUnit(originalHours, "percent", ctx);
    const backToHours = (asPercent / 100) * personMonthHours(weeklyHours, workingDays);

    expect(backToHours).toBeCloseTo(originalHours, 6);
  });

  it("largest-remainder rounding makes displayed cells sum exactly to the displayed total", () => {
    // Deliberately awkward values that would NOT reconcile under naive
    // per-cell rounding to 2dp.
    const values = [0.805, 1.005, 3.045, 2.405];
    const rounded = largestRemainderRound(values, 2);
    const exactTotal = values.reduce((a, b) => a + b, 0);
    const roundedTotal = Math.round(exactTotal * 100) / 100;
    const sumOfRounded = rounded.reduce((a, b) => a + b, 0);

    expect(Math.round(sumOfRounded * 100) / 100).toBe(roundedTotal);
  });
});
