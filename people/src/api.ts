import type { DisplayCurrency } from "@baseline/domain";

export interface Employee {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
}

export interface RateRecord {
  id: string;
  employeeId: string;
  validFrom: string;
  hourlyCost: number;
}

/**
 * Read-only context Shell pushes in at runtime (see shell/src/App.tsx).
 * People renders in it but never owns or changes it. Standalone mode
 * supplies a default.
 */
export interface ShellContext {
  activeUser: string;
  displayCurrency: DisplayCurrency;
}

/** One over-capacity (employee, month) from GET /api/capacity. */
export interface CapacityFlag {
  employeeId: string;
  month: string;
  totalAllocatedHours: number;
  capacityHours: number;
  breakdownItemName?: string;
  projectName?: string | null;
}

/** Messages on the SSE channel; payloads are small and route-shaped. */
export type ServerEvent =
  | { type: "rate.changed"; payload: { employeeId: string } }
  | { type: "allocation.changed"; payload: { employeeId: string; month: string; breakdownItemId: string } }
  | { type: "breakdown.changed"; payload: { projectId: string } }
  | { type: "reset"; payload: Record<string, never> };

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  listEmployees: () => fetch(`${BASE}/employees`).then((r) => json<Employee[]>(r)),

  listRates: (employeeId: string) =>
    fetch(`${BASE}/employees/${employeeId}/rates`).then((r) => json<RateRecord[]>(r)),

  listCapacityFlags: () => fetch(`${BASE}/capacity`).then((r) => json<CapacityFlag[]>(r)),

  addRate: (employeeId: string, validFrom: string, hourlyCost: number) =>
    fetch(`${BASE}/employees/${employeeId}/rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validFrom, hourlyCost }),
    }).then((r) => json<{ id: string }>(r)),

  updateRate: (rateId: string, patch: Partial<Pick<RateRecord, "validFrom" | "hourlyCost">>) =>
    fetch(`${BASE}/rates/${rateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<RateRecord>(r)),

  deleteRate: (rateId: string) =>
    fetch(`${BASE}/rates/${rateId}`, { method: "DELETE" }).then((r) => json<void>(r)),

  /** Opens a Server-Sent Events connection. Caller is responsible for closing it. */
  subscribe: (onMessage: (msg: ServerEvent) => void) => {
    const source = new EventSource(`${BASE}/events`);
    source.onmessage = (evt) => {
      try {
        onMessage(JSON.parse(evt.data) as ServerEvent);
      } catch {
        /* ignore malformed events */
      }
    };
    return () => source.close();
  },
};
