import type { DisplayUnit, DisplayCurrency } from "@baseline/domain";

/**
 * Read-only context Shell pushes in at runtime (see shell/src/App.tsx).
 * Delivery prices its grid in it; it never owns or changes it. Standalone
 * mode supplies a default.
 */
export interface ShellContext {
  activeUser: string;
  displayCurrency: DisplayCurrency;
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

export interface Employee {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
}

export interface Allocation {
  id: string;
  breakdownItemId: string;
  employeeId: string;
  month: string;
  hours: number;
  updatedAt?: number;
}

export interface MonthCostResponse {
  breakdown: {
    workingDaysInMonth: number;
    slices: { workingDays: number; hourlyCost: number }[];
    hoursPerWorkingDay: number;
    totalHours: number;
    totalCost: number;
    blendedRatePerHour: number;
    beforeFirstRate: boolean;
  };
  capacity: {
    totalAllocatedHours: number;
    capacityHours: number;
    isOverCapacity: boolean;
    causingAllocationId: string | null;
    /** R5: the assignment that tipped this person over, present only when over */
    causing?: {
      allocationId: string;
      breakdownItemId: string;
      breakdownItemName: string;
      projectName: string | null;
      month: string;
      hours: number;
    };
  };
}

export interface Meta {
  name?: string;
  version?: string;
  gridHorizon?: { from: string; to: string };
  note?: string;
}

export interface RollupRow {
  breakdownItemId: string;
  name: string;
  parentId: string | null;
  depth: number;
  isLeaf: boolean;
  /** month -> displayed value in the requested unit */
  byMonth: Record<string, number>;
  rowTotal: number;
}

export interface RollupResult {
  unit: DisplayUnit;
  months: string[];
  rows: RollupRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
  hasBeforeFirstRate: boolean;
}

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  meta: () => fetch(`${BASE}/meta`).then((r) => json<Meta>(r)),

  listProjects: () => fetch(`${BASE}/projects`).then((r) => json<Project[]>(r)),

  listBreakdownItems: (projectId?: string) =>
    fetch(
      `${BASE}/breakdown-items${projectId ? `?projectId=${projectId}` : ""}`,
    ).then((r) => json<BreakdownItem[]>(r)),

  createBreakdownItem: (
    projectId: string,
    parentId: string | null,
    name: string,
  ) =>
    fetch(`${BASE}/breakdown-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, parentId, name }),
    }).then((r) => json<{ id: string }>(r)),

  renameOrMoveBreakdownItem: (
    id: string,
    patch: { name?: string; parentId?: string | null },
  ) =>
    fetch(`${BASE}/breakdown-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<BreakdownItem>(r)),

  deleteBreakdownItem: (id: string) =>
    fetch(`${BASE}/breakdown-items/${id}`, { method: "DELETE" }).then((r) =>
      json<void>(r),
    ),

  listEmployees: () =>
    fetch(`${BASE}/employees`).then((r) => json<Employee[]>(r)),

  listAllocations: (params: {
    breakdownItemId?: string;
    employeeId?: string;
    month?: string;
  }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return fetch(`${BASE}/allocations${qs ? `?${qs}` : ""}`).then((r) =>
      json<Allocation[]>(r),
    );
  },

  putAllocation: (
    id: string,
    hours: number,
    createIfMissing?: {
      breakdownItemId: string;
      employeeId: string;
      month: string;
    },
  ) =>
    fetch(`${BASE}/allocations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours, ...createIfMissing }),
    }).then((r) => json<Allocation>(r)),

  monthCost: (employeeId: string, month: string, breakdownItemId?: string) =>
    fetch(
      `${BASE}/employees/${employeeId}/months/${month}/cost${
        breakdownItemId ? `?breakdownItemId=${breakdownItemId}` : ""
      }`,
    ).then((r) => json<MonthCostResponse>(r)),

  rollup: (projectId: string, unit: DisplayUnit) =>
    fetch(`${BASE}/projects/${projectId}/rollup?unit=${unit}`).then((r) =>
      json<RollupResult>(r),
    ),

  subscribe: (onMessage: (msg: { type: string; payload: unknown }) => void) => {
    const source = new EventSource(`${BASE}/events`);
    source.onmessage = (evt) => {
      try {
        onMessage(JSON.parse(evt.data));
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  },
};
