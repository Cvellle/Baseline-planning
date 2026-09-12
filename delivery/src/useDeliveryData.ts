import { useEffect, useMemo, useState } from "react";
import {
  hoursToUnit,
  unitToHours,
  roundForDisplay,
  getWorkingDaysInMonth,
  convertFromEur,
  convertToEur,
  DisplayUnit,
  DisplayCurrency,
} from "@baseline/domain";
import { api, Project, BreakdownItem, Employee, Allocation, RollupResult } from "./api";
import { FALLBACK_MONTHS, monthRange, shortMonth } from "./months";

export interface CellInfo {
  blended: number;
  over: boolean;
  beforeFirstRate: boolean;
  causing?: NonNullable<Awaited<ReturnType<typeof api.monthCost>>["capacity"]["causing"]>;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Owns all of Delivery's server state: the project/breakdown tree, the open
 * leaf's allocations and per-cell rate/capacity info, and the project
 * roll-up. Keeps everything live over SSE (rate, allocation and breakdown
 * changes), and exposes the mutation handlers the UI calls into.
 */
export function useDeliveryData(currency: DisplayCurrency, unit: DisplayUnit) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>(FALLBACK_MONTHS);
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rollup, setRollup] = useState<RollupResult | null>(null);
  // employeeId+month -> blended rate / capacity / before-first-rate for the open leaf
  const [cellInfo, setCellInfo] = useState<Record<string, CellInfo>>({});

  useEffect(() => {
    api.meta().then((m) => {
      if (m.gridHorizon) setMonths(monthRange(m.gridHorizon.from, m.gridHorizon.to));
    });
    api.listProjects().then((p) => {
      setProjects(p);
      if (p[0]) setProjectId(p[0].id);
    });
    api.listEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    if (projectId) api.listBreakdownItems(projectId).then(setItems);
  }, [projectId]);

  useEffect(() => {
    if (selectedItemId) refreshAllocations(selectedItemId);
  }, [selectedItemId]);

  // Roll-up: (re)load whenever project / unit changes...
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.rollup(projectId, unit).then((r) => {
      if (!cancelled) setRollup(r);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, unit]);

  // ...and keep it live as rates / allocations / the tree change, no reload.
  useEffect(() => {
    if (!projectId) return;
    return api.subscribe((msg) => {
      if (["allocation.changed", "rate.changed", "breakdown.changed", "reset"].includes(msg.type)) {
        api.rollup(projectId, unit).then(setRollup);
      }
    });
  }, [projectId, unit]);

  useEffect(() => {
    return api.subscribe((msg) => {
      if (msg.type === "rate.changed") {
        setCellInfo({});
        if (selectedItemId) refreshAllocations(selectedItemId);
      }
      if (msg.type === "allocation.changed" && selectedItemId) {
        refreshAllocations(selectedItemId);
      }
      if (msg.type === "breakdown.changed" && projectId) {
        api.listBreakdownItems(projectId).then(setItems);
      }
    });
  }, [selectedItemId, projectId]);

  async function refreshAllocations(itemId: string) {
    const rows = await api.listAllocations({ breakdownItemId: itemId });
    setAllocations(rows);
    const allKeys = rows.map((r) => `${r.employeeId}:${r.month}`);
    const pairs = allKeys.filter((key, i) => allKeys.indexOf(key) === i);
    const info: Record<string, CellInfo> = {};
    await Promise.all(
      pairs.map(async (key) => {
        const [employeeId, month] = key.split(":");
        const res = await api.monthCost(employeeId, month, itemId);
        info[key] = {
          blended: res.breakdown.blendedRatePerHour,
          beforeFirstRate: res.breakdown.beforeFirstRate,
          over: res.capacity.isOverCapacity,
          causing: res.capacity.causing,
        };
      })
    );
    setCellInfo(info);
  }

  const childrenOf = (id: string) => items.filter((i) => i.parentId === id);
  const isLeaf = (id: string) => childrenOf(id).length === 0;

  const rowEmployeeIds = useMemo(() => {
    const ids = allocations.map((a) => a.employeeId);
    return ids.filter((id, i) => ids.indexOf(id) === i);
  }, [allocations]);

  // Object.entries keys are already unique, so no dedupe step is needed.
  const overCapacityNotes = useMemo(
    () =>
      Object.entries(cellInfo)
        .filter(([, info]) => info.over && info.causing)
        .map(([key, info]) => {
          const [employeeId, month] = key.split(":");
          const emp = employees.find((e) => e.id === employeeId)?.name ?? employeeId;
          const c = info.causing!;
          return {
            key,
            text: `${emp} is over capacity in ${shortMonth(month)} once every project is counted — caused by the most recent edit: ${c.hours.toFixed(
              1
            )}h on "${c.breakdownItemName}"${c.projectName ? ` (${c.projectName})` : ""}.`,
          };
        }),
    [cellInfo, employees]
  );

  async function handleAddChild(parentId: string | null, name: string): Promise<ActionResult> {
    if (!projectId) return { ok: false, message: "No project selected." };
    try {
      await api.createBreakdownItem(projectId, parentId, name);
      return { ok: true };
    } catch (err) {
      // R4: the API refuses a child under an item that has its own allocations.
      return {
        ok: false,
        message:
          err instanceof Error && err.message.includes("409")
            ? "Can't add a child here: this item has its own allocations, and a parent's effort must be derived from its children. Move or clear its allocations first."
            : "Could not create the item.",
      };
    }
  }

  async function handleRename(item: BreakdownItem, name: string) {
    await api.renameOrMoveBreakdownItem(item.id, { name });
  }

  async function handleMove(item: BreakdownItem, parentId: string | null): Promise<ActionResult> {
    try {
      await api.renameOrMoveBreakdownItem(item.id, { parentId });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error && err.message.includes("409")
            ? "That move isn't allowed — it would nest the item inside its own subtree, or the target already has its own allocations."
            : "Could not move the item.",
      };
    }
  }

  async function handleDelete(item: BreakdownItem): Promise<ActionResult> {
    try {
      await api.deleteBreakdownItem(item.id);
      if (selectedItemId === item.id) setSelectedItemId(null);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not delete -- it may still have children. Move or delete those first." };
    }
  }

  function findAllocation(employeeId: string, month: string): Allocation | undefined {
    return allocations.find((a) => a.employeeId === employeeId && a.month === month);
  }

  async function handleAddEmployeeRow(employeeId: string) {
    if (!selectedItemId) return;
    const id = `new-${selectedItemId}-${employeeId}-${months[0]}`;
    await api.putAllocation(id, 0, { breakdownItemId: selectedItemId, employeeId, month: months[0] });
    refreshAllocations(selectedItemId);
  }

  async function handleCellEdit(employeeId: string, month: string, rawValue: string) {
    if (!selectedItemId) return;
    const employee = employees.find((e) => e.id === employeeId)!;
    const [year, month1] = month.split("-").map(Number);
    const workingDaysInMonth = getWorkingDaysInMonth(year, month1);
    const key = `${employeeId}:${month}`;
    const blendedRatePerHour = cellInfo[key]?.blended;

    let numeric = Number(rawValue);
    if (Number.isNaN(numeric)) return;
    // The grid edits cost in the Shell's currency; the canonical rate is EUR.
    if (unit === "cost" && currency !== "EUR") numeric = convertToEur(numeric, currency);

    const hours = unitToHours(numeric, unit, {
      weeklyHours: employee.weeklyHours,
      workingDaysInMonth,
      blendedRatePerHour,
    });

    const existing = findAllocation(employeeId, month);
    const id = existing?.id ?? `new-${selectedItemId}-${employeeId}-${month}`;
    await api.putAllocation(id, hours, { breakdownItemId: selectedItemId, employeeId, month });
    refreshAllocations(selectedItemId);
  }

  function displayValue(employeeId: string, month: string): string {
    const alloc = findAllocation(employeeId, month);
    const employee = employees.find((e) => e.id === employeeId);
    if (!alloc || !employee) return "";
    const [year, month1] = month.split("-").map(Number);
    const workingDaysInMonth = getWorkingDaysInMonth(year, month1);
    const key = `${employeeId}:${month}`;
    const blendedRatePerHour = cellInfo[key]?.blended;

    // Converting to/from "cost" needs the cell's blended rate; until it has
    // loaded, show a placeholder rather than throwing.
    if (unit === "cost" && blendedRatePerHour === undefined) return "…";

    const eurValue = hoursToUnit(alloc.hours, unit, {
      weeklyHours: employee.weeklyHours,
      workingDaysInMonth,
      blendedRatePerHour,
    });
    // hoursToUnit returns EUR for "cost"; the grid edits in the Shell's currency.
    if (unit === "cost") return convertFromEur(eurValue, currency).toFixed(2);
    return String(roundForDisplay(eurValue, unit));
  }

  return {
    projects,
    projectId,
    setProjectId,
    months,
    items,
    selectedItemId,
    setSelectedItemId,
    employees,
    rollup,
    cellInfo,
    childrenOf,
    isLeaf,
    rowEmployeeIds,
    overCapacityNotes,
    handleAddChild,
    handleRename,
    handleMove,
    handleDelete,
    handleAddEmployeeRow,
    handleCellEdit,
    displayValue,
  };
}
