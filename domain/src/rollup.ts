import {
  Allocation,
  BreakdownItem,
  Employee,
  RateRecord,
  DisplayUnit,
} from "./types.js";
import { computeMonthCost } from "./rates.js";
import { getWorkingDaysInMonth, parseYearMonth } from "./workingDays.js";
import { hoursToUnit, DISPLAY_PRECISION } from "./units.js";
import { largestRemainderRound } from "./rounding.js";

/**
 * Figure 5's multi-level view: every breakdown item in a project laid out
 * as rows, months as columns, plus a Total column and a project-total row.
 *
 * Two things have to hold for the numbers to be trustworthy (see the spec's
 * "totals that reconcile"):
 *
 *  1. A parent row equals the sum of its children -- in every month cell
 *     AND in the Total column.
 *  2. Every Total-column cell equals the sum of that row's month cells, and
 *     the project-total row equals the sum of the root rows.
 *
 * Independent per-cell rounding breaks both (classic apportionment). We fix
 * it bottom-up: leaf cells are apportioned with largest-remainder rounding
 * so a leaf row's month cells sum exactly to its rounded Total; every parent
 * cell is then just the exact sum of its already-rounded children, so the
 * tree stays reconciled all the way up.
 */

export interface RollupRow {
  breakdownItemId: string;
  name: string;
  parentId: string | null;
  /** 0 for a root item, +1 per level of nesting */
  depth: number;
  isLeaf: boolean;
  /** month ("YYYY-MM") -> displayed value in the requested unit */
  byMonth: Record<string, number>;
  /** sum of this row's month cells, in the requested unit */
  rowTotal: number;
}

export interface RollupResult {
  unit: DisplayUnit;
  months: string[];
  /** depth-first preorder: a parent always precedes its descendants */
  rows: RollupRow[];
  /** month -> sum of the root rows for that month */
  columnTotals: Record<string, number>;
  /** sum of every column total (== sum of the root row totals) */
  grandTotal: number;
  /**
   * true when at least one leaf cell landed in a month before that
   * employee's first rate record -- only meaningful for unit "cost", where
   * such cells contribute 0 and the figure is therefore understated.
   */
  hasBeforeFirstRate: boolean;
}

export interface ComputeRollupInput {
  /** every breakdown item for the one project being rolled up */
  items: BreakdownItem[];
  /** allocations for (at least) those items; others are ignored */
  allocations: Allocation[];
  employees: Employee[];
  rates: RateRecord[];
  /** ordered list of "YYYY-MM" columns, e.g. the grid horizon */
  months: string[];
  unit: DisplayUnit;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // +Number.EPSILON nudges values like 2.005 that sit just below the
  // rounding boundary in binary floating point.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function computeRollup(input: ComputeRollupInput): RollupResult {
  const { items, allocations, employees, rates, months, unit } = input;
  const decimals = DISPLAY_PRECISION[unit];

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const ratesByEmployee = new Map<string, RateRecord[]>();
  for (const r of rates) {
    const list = ratesByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    ratesByEmployee.set(r.employeeId, list);
  }

  const childrenByParent = new Map<string | null, BreakdownItem[]>();
  for (const item of items) {
    const list = childrenByParent.get(item.parentId) ?? [];
    list.push(item);
    childrenByParent.set(item.parentId, list);
  }
  const isLeaf = (id: string) => (childrenByParent.get(id) ?? []).length === 0;

  const allocationsByItem = new Map<string, Allocation[]>();
  for (const a of allocations) {
    const list = allocationsByItem.get(a.breakdownItemId) ?? [];
    list.push(a);
    allocationsByItem.set(a.breakdownItemId, list);
  }

  let hasBeforeFirstRate = false;

  /** Exact (un-rounded) value of one leaf cell, summed across everyone staffed on it. */
  function exactLeafCell(itemId: string, month: string): number {
    const { year, month1 } = parseYearMonth(month);
    const workingDaysInMonth = getWorkingDaysInMonth(year, month1);
    let sum = 0;
    for (const a of allocationsByItem.get(itemId) ?? []) {
      if (a.month !== month) continue;
      const employee = employeesById.get(a.employeeId);
      if (!employee) continue;

      if (unit === "hours") {
        sum += a.hours;
      } else if (unit === "cost") {
        const breakdown = computeMonthCost(
          employee.weeklyHours,
          ratesByEmployee.get(a.employeeId) ?? [],
          year,
          month1,
          a.hours
        );
        if (breakdown.beforeFirstRate) hasBeforeFirstRate = true;
        sum += breakdown.totalCost;
      } else {
        sum += hoursToUnit(a.hours, unit, {
          weeklyHours: employee.weeklyHours,
          workingDaysInMonth,
        });
      }
    }
    return sum;
  }

  const rowsById = new Map<string, RollupRow>();

  /** Post-order: fill in a node from its children (or its allocations, if a leaf). */
  function build(item: BreakdownItem, depth: number): RollupRow {
    const leaf = isLeaf(item.id);
    const byMonth: Record<string, number> = {};

    if (leaf) {
      const exact = months.map((m) => exactLeafCell(item.id, m));
      const displayed = largestRemainderRound(exact, decimals);
      months.forEach((m, i) => {
        byMonth[m] = displayed[i];
      });
    } else {
      const children = (childrenByParent.get(item.id) ?? []).map((c) =>
        build(c, depth + 1)
      );
      for (const m of months) {
        byMonth[m] = roundTo(
          children.reduce((s, c) => s + c.byMonth[m], 0),
          decimals
        );
      }
    }

    const rowTotal = roundTo(
      months.reduce((s, m) => s + byMonth[m], 0),
      decimals
    );
    const row: RollupRow = {
      breakdownItemId: item.id,
      name: item.name,
      parentId: item.parentId,
      depth,
      isLeaf: leaf,
      byMonth,
      rowTotal,
    };
    rowsById.set(item.id, row);
    return row;
  }

  const roots = childrenByParent.get(null) ?? [];
  for (const root of roots) build(root, 0);

  // Emit rows in depth-first preorder so the client can indent by depth.
  const rows: RollupRow[] = [];
  function emit(item: BreakdownItem) {
    const row = rowsById.get(item.id);
    if (row) rows.push(row);
    for (const child of childrenByParent.get(item.id) ?? []) emit(child);
  }
  for (const root of roots) emit(root);

  const columnTotals: Record<string, number> = {};
  for (const m of months) {
    columnTotals[m] = roundTo(
      roots.reduce((s, r) => s + (rowsById.get(r.id)?.byMonth[m] ?? 0), 0),
      decimals
    );
  }
  const grandTotal = roundTo(
    months.reduce((s, m) => s + columnTotals[m], 0),
    decimals
  );

  return { unit, months, rows, columnTotals, grandTotal, hasBeforeFirstRate };
}
