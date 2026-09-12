import { describe, it, expect } from "vitest";
import { computeRollup } from "../src/rollup.js";
import { BreakdownItem, Employee, RateRecord, Allocation } from "../src/types.js";

/**
 * Tree:
 *   root  "R"
 *     ├─ "A"  (leaf)
 *     └─ "B"  (parent)
 *          └─ "B1" (leaf)
 */
const items: BreakdownItem[] = [
  { id: "R", projectId: "p", parentId: null, name: "R" },
  { id: "A", projectId: "p", parentId: "R", name: "A" },
  { id: "B", projectId: "p", parentId: "R", name: "B" },
  { id: "B1", projectId: "p", parentId: "B", name: "B1" },
];

const employees: Employee[] = [
  { id: "e1", name: "A. Okafor", role: "Tech Lead", weeklyHours: 40 },
  { id: "e2", name: "L. Okafor", role: "FE", weeklyHours: 40 },
];

// Fig. 4 rates for e1: €80/h then €95/h from 2026-03-12.
const rates: RateRecord[] = [
  { id: "r1", employeeId: "e1", validFrom: "2025-01-01", hourlyCost: 80 },
  { id: "r2", employeeId: "e1", validFrom: "2026-03-12", hourlyCost: 95 },
  { id: "r3", employeeId: "e2", validFrom: "2025-01-01", hourlyCost: 100 },
];

// March 2026: 22 working days, one person-month for a 40h/week person = 176h.
const MARCH_PM_HOURS = 176;
const APRIL_PM_HOURS = 40 * (22 / 5); // April 2026 also has 22 working days

const allocations: Allocation[] = [
  // e1 @ 0.5 PM on leaf A in March -> the Fig. 4 cell, €7,880.00
  { id: "a1", breakdownItemId: "A", employeeId: "e1", month: "2026-03", hours: 0.5 * MARCH_PM_HOURS },
  // e2 @ 0.25 PM on leaf B1 in March
  { id: "a2", breakdownItemId: "B1", employeeId: "e2", month: "2026-03", hours: 0.25 * MARCH_PM_HOURS },
  // e1 @ 1.0 PM on leaf A in April
  { id: "a3", breakdownItemId: "A", employeeId: "e1", month: "2026-04", hours: 1.0 * APRIL_PM_HOURS },
];

const months = ["2026-03", "2026-04"];

describe("computeRollup", () => {
  it("hours: parent rows equal the sum of their children, every cell", () => {
    const r = computeRollup({ items, allocations, employees, rates, months, unit: "hours" });
    const row = (id: string) => r.rows.find((x) => x.breakdownItemId === id)!;

    // B has one child B1 -> identical
    expect(row("B").byMonth["2026-03"]).toBe(row("B1").byMonth["2026-03"]);
    expect(row("B").rowTotal).toBe(row("B1").rowTotal);

    // R = A + B in every month and in the total
    for (const m of months) {
      expect(row("R").byMonth[m]).toBeCloseTo(row("A").byMonth[m] + row("B").byMonth[m], 6);
    }
    expect(row("R").rowTotal).toBeCloseTo(row("A").rowTotal + row("B").rowTotal, 6);
  });

  it("row totals equal the sum of the row's month cells; grand total ties out", () => {
    const r = computeRollup({ items, allocations, employees, rates, months, unit: "hours" });
    for (const row of r.rows) {
      const sum = months.reduce((s, m) => s + row.byMonth[m], 0);
      expect(row.rowTotal).toBeCloseTo(sum, 6);
    }
    const colSum = months.reduce((s, m) => s + r.columnTotals[m], 0);
    expect(r.grandTotal).toBeCloseTo(colSum, 6);

    // grand total == every hour allocated
    const allHours = allocations.reduce((s, a) => s + a.hours, 0);
    expect(r.grandTotal).toBeCloseTo(allHours, 6);
  });

  it("cost: the Fig. 4 leaf cell rolls up to €7,880.00 under its parents", () => {
    const r = computeRollup({ items, allocations, employees, rates, months, unit: "cost" });
    const row = (id: string) => r.rows.find((x) => x.breakdownItemId === id)!;

    expect(row("A").byMonth["2026-03"]).toBeCloseTo(7880, 2);
    // R's March cell is A's €7,880 plus B1's 44h @ €100 = €4,400
    expect(row("R").byMonth["2026-03"]).toBeCloseTo(7880 + 4400, 2);
    expect(r.columnTotals["2026-03"]).toBeCloseTo(row("R").byMonth["2026-03"], 2);
  });

  it("percent: awkward values still reconcile to the displayed total", () => {
    const r = computeRollup({ items, allocations, employees, rates, months, unit: "percent" });
    for (const row of r.rows) {
      const sum = Number(months.reduce((s, m) => s + row.byMonth[m], 0).toFixed(1));
      expect(row.rowTotal).toBeCloseTo(sum, 6);
    }
  });

  it("flags a pre-first-rate month for cost only", () => {
    const early: Allocation[] = [
      { id: "x", breakdownItemId: "A", employeeId: "e1", month: "2024-06", hours: 80 },
    ];
    const r = computeRollup({
      items,
      allocations: early,
      employees,
      rates,
      months: ["2024-06"],
      unit: "cost",
    });
    expect(r.hasBeforeFirstRate).toBe(true);
    expect(r.rows.find((x) => x.breakdownItemId === "A")!.byMonth["2024-06"]).toBe(0);
  });
});
