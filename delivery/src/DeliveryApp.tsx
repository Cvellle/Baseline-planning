import { useEffect, useMemo, useState } from "react";
import {
  hoursToUnit,
  unitToHours,
  roundForDisplay,
  getWorkingDaysInMonth,
  formatMoney,
  convertFromEur,
  convertToEur,
  DisplayUnit,
  DisplayCurrency,
} from "@baseline/domain";
import { api, Project, BreakdownItem, Employee, Allocation, RollupResult, ShellContext } from "./api";

/**
 * This is the module Module Federation exposes as "./DeliveryApp" (see
 * vite.config.ts). It never imports from People directly -- the only thing
 * the two apps share is the @baseline/domain calculation package and the
 * REST/SSE contract exposed by the api service. See README for why.
 *
 * Shell mounts it with a `shell` prop (active user + display currency);
 * main.tsx mounts it standalone with a default.
 */

const STANDALONE_SHELL: ShellContext = { activeUser: "standalone", displayCurrency: "EUR" };

// Fallback grid horizon, used only until GET /api/meta answers.
const FALLBACK_MONTHS: string[] = (() => {
  const out: string[] = [];
  let year = 2026;
  let month = 4;
  for (let i = 0; i < 12; i++) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
})();

function monthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const shortMonth = (m: string) => {
  const [y, mo] = m.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mo)]} ${y.slice(2)}`;
};

interface CellInfo {
  blended: number;
  over: boolean;
  beforeFirstRate: boolean;
  causing?: NonNullable<Awaited<ReturnType<typeof api.monthCost>>["capacity"]["causing"]>;
}

export function DeliveryApp({ shell = STANDALONE_SHELL }: { shell?: ShellContext }) {
  const currency: DisplayCurrency = shell.displayCurrency;

  const UNITS: { value: DisplayUnit; label: string }[] = [
    { value: "hours", label: "Hours" },
    { value: "personMonths", label: "Person-months" },
    { value: "percent", label: "% of capacity" },
    { value: "cost", label: `Cost (${currency})` },
  ];

  /** Display formatting per unit; cost is rendered in the Shell's currency. */
  function fmt(value: number, unit: DisplayUnit): string {
    if (value === 0) return "";
    if (unit === "cost") return formatMoney(value, currency); // value is EUR
    if (unit === "percent") return value.toFixed(1) + "%";
    return value.toFixed(2);
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>(FALLBACK_MONTHS);
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [unit, setUnit] = useState<DisplayUnit>("personMonths");
  const [view, setView] = useState<"grid" | "rollup">("rollup");
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

  // Roll-up view: (re)load whenever project / unit / view changes...
  useEffect(() => {
    if (view !== "rollup" || !projectId) return;
    let cancelled = false;
    api.rollup(projectId, unit).then((r) => {
      if (!cancelled) setRollup(r);
    });
    return () => {
      cancelled = true;
    };
  }, [view, projectId, unit]);

  // ...and keep it live as rates / allocations / the tree change, no reload.
  useEffect(() => {
    if (view !== "rollup" || !projectId) return;
    return api.subscribe((msg) => {
      if (["allocation.changed", "rate.changed", "breakdown.changed", "reset"].includes(msg.type)) {
        api.rollup(projectId, unit).then(setRollup);
      }
    });
  }, [view, projectId, unit]);

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
    const pairs = new Set(rows.map((r) => `${r.employeeId}:${r.month}`));
    const info: Record<string, CellInfo> = {};
    await Promise.all(
      [...pairs].map(async (key) => {
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

  const rowEmployeeIds = useMemo(
    () => [...new Set(allocations.map((a) => a.employeeId))],
    [allocations]
  );

  const overCapacityNotes = useMemo(() => {
    const seen = new Set<string>();
    const notes: { key: string; text: string }[] = [];
    for (const [key, info] of Object.entries(cellInfo)) {
      if (!info.over || !info.causing) continue;
      const [employeeId, month] = key.split(":");
      const emp = employees.find((e) => e.id === employeeId)?.name ?? employeeId;
      const c = info.causing;
      const dedupe = `${employeeId}:${month}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      notes.push({
        key: dedupe,
        text: `${emp} is over capacity in ${shortMonth(month)} once every project is counted — caused by the most recent edit: ${c.hours.toFixed(
          1
        )}h on "${c.breakdownItemName}"${c.projectName ? ` (${c.projectName})` : ""}.`,
      });
    }
    return notes;
  }, [cellInfo, employees]);

  async function handleAddChild(parentId: string | null) {
    if (!projectId) return;
    const name = prompt("Name for the new breakdown item?");
    if (!name) return;
    try {
      await api.createBreakdownItem(projectId, parentId, name);
    } catch (err) {
      // R4: the API refuses a child under an item that has its own allocations.
      alert(
        err instanceof Error && err.message.includes("409")
          ? "Can't add a child here: this item has its own allocations, and a parent's effort must be derived from its children. Move or clear its allocations first."
          : "Could not create the item."
      );
    }
  }

  async function handleRename(item: BreakdownItem) {
    const name = prompt("Rename to?", item.name);
    if (!name) return;
    await api.renameOrMoveBreakdownItem(item.id, { name });
  }

  async function handleMove(item: BreakdownItem) {
    const candidates = items
      .filter((i) => i.id !== item.id)
      .map((i) => `${i.id}: ${i.name}`)
      .join("\n");
    const chosen = prompt(
      `Move "${item.name}" under which item?\nEnter a breakdown-item id, or "root" for the top level.\n\n${candidates}`
    );
    if (!chosen) return;
    const parentId = chosen.trim() === "root" ? null : chosen.split(":")[0].trim();
    try {
      await api.renameOrMoveBreakdownItem(item.id, { parentId });
    } catch (err) {
      alert(
        err instanceof Error && err.message.includes("409")
          ? "That move isn't allowed — it would nest the item inside its own subtree, or the target already has its own allocations."
          : "Could not move the item (unknown target?)."
      );
    }
  }

  async function handleDelete(item: BreakdownItem) {
    if (!confirm(`Delete "${item.name}"? This only works if it has no children.`)) return;
    try {
      await api.deleteBreakdownItem(item.id);
      if (selectedItemId === item.id) setSelectedItemId(null);
    } catch {
      alert("Could not delete -- it may still have children. Move or delete those first.");
    }
  }

  function findAllocation(employeeId: string, month: string): Allocation | undefined {
    return allocations.find((a) => a.employeeId === employeeId && a.month === month);
  }

  async function handleAddEmployeeRow() {
    if (!selectedItemId) return;
    const options = employees.map((e) => `${e.id}: ${e.name}`).join("\n");
    const chosen = prompt(`Employee id to add a row for?\n\n${options}`);
    if (!chosen) return;
    const employeeId = chosen.split(":")[0].trim();
    if (!employees.some((e) => e.id === employeeId)) return alert("Unknown employee id.");
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

  function renderTree(parentId: string | null, depth: number) {
    const nodes = items.filter((i) => i.parentId === parentId);
    return nodes.map((item) => (
      <div key={item.id} style={{ marginLeft: depth * 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 4px",
            background: item.id === selectedItemId ? "#eef" : "transparent",
          }}
        >
          <span
            onClick={() => isLeaf(item.id) && setSelectedItemId(item.id)}
            style={{ cursor: isLeaf(item.id) ? "pointer" : "default", flex: 1 }}
          >
            {isLeaf(item.id) ? "•" : "▾"} {item.name}
          </span>
          <button onClick={() => handleAddChild(item.id)} title="Add child">
            +
          </button>
          <button onClick={() => handleRename(item)} title="Rename">
            ✎
          </button>
          <button onClick={() => handleMove(item)} title="Move under another item">
            ⤴
          </button>
          <button onClick={() => handleDelete(item)} title="Delete">
            ×
          </button>
        </div>
        {renderTree(item.id, depth + 1)}
      </div>
    ));
  }

  function renderRollup() {
    if (!rollup) return <div style={{ opacity: 0.6 }}>Loading roll-up...</div>;
    if (rollup.rows.length === 0)
      return <div style={{ opacity: 0.6 }}>This project has no breakdown items yet.</div>;

    return (
      <div>
        <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 8px", maxWidth: 720 }}>
          Every breakdown item, rolled up: a parent row is the exact sum of its children, and the
          Total column / Project total row are the sum of the cells shown — largest-remainder
          rounding keeps them reconciled. Read-only; edit values in the leaf grid.
        </p>
        {rollup.hasBeforeFirstRate && unit === "cost" && (
          <p style={{ fontSize: 12, color: "#a60", margin: "0 0 8px" }}>
            Some cells fall in a month before that person's first rate record; those contribute 0,
            so the cost shown is a lower bound.
          </p>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, position: "sticky", left: 0, background: "#fff" }}>Breakdown item</th>
                {rollup.months.map((m) => (
                  <th key={m} style={{ ...th, textAlign: "right" }}>
                    {shortMonth(m)}
                  </th>
                ))}
                <th style={{ ...th, textAlign: "right", borderLeft: "2px solid #ccc" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rollup.rows.map((r) => (
                <tr key={r.breakdownItemId}>
                  <td
                    style={{
                      ...td,
                      position: "sticky",
                      left: 0,
                      background: "#fff",
                      paddingLeft: 8 + r.depth * 16,
                      fontWeight: r.isLeaf ? 400 : 600,
                    }}
                  >
                    {r.isLeaf ? "" : "▾ "}
                    {r.name}
                  </td>
                  {rollup.months.map((m) => (
                    <td key={m} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(r.byMonth[m] ?? 0, unit)}
                    </td>
                  ))}
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      borderLeft: "2px solid #ccc",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(r.rowTotal, unit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  style={{
                    ...td,
                    position: "sticky",
                    left: 0,
                    background: "#f6f6f6",
                    fontWeight: 700,
                    borderTop: "2px solid #ccc",
                  }}
                >
                  Project total
                </td>
                {rollup.months.map((m) => (
                  <td
                    key={m}
                    style={{
                      ...td,
                      textAlign: "right",
                      fontWeight: 700,
                      borderTop: "2px solid #ccc",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(rollup.columnTotals[m] ?? 0, unit)}
                  </td>
                ))}
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontWeight: 800,
                    borderTop: "2px solid #ccc",
                    borderLeft: "2px solid #ccc",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(rollup.grandTotal, unit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Delivery</h2>
        <span style={{ fontSize: 11, opacity: 0.55 }}>
          {shell.activeUser} · {currency}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div role="tablist" style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setView("rollup")} style={{ fontWeight: view === "rollup" ? 700 : 400 }}>
            Project roll-up
          </button>
          <button onClick={() => setView("grid")} style={{ fontWeight: view === "grid" ? 700 : 400 }}>
            Leaf grid (edit)
          </button>
        </div>

        <select value={unit} onChange={(e) => setUnit(e.target.value as DisplayUnit)}>
          {UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      {view === "rollup" && renderRollup()}

      {view === "grid" && (
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: "0 0 320px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Work breakdown</strong>
              <button onClick={() => handleAddChild(null)}>+ Root item</button>
            </div>
            <div style={{ marginTop: 8, maxHeight: 480, overflowY: "auto" }}>{renderTree(null, 0)}</div>
          </div>

          <div style={{ flex: 1 }}>
            {!selectedItemId && <div style={{ opacity: 0.6 }}>Select a leaf item to open its staffing grid.</div>}
            {selectedItemId && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <strong>{items.find((i) => i.id === selectedItemId)?.name}</strong>
                  <button onClick={handleAddEmployeeRow}>+ Add person</button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={th}>Person</th>
                        {months.map((m) => (
                          <th key={m} style={th}>
                            {shortMonth(m)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowEmployeeIds.map((employeeId) => {
                        const employee = employees.find((e) => e.id === employeeId);
                        return (
                          <tr key={employeeId}>
                            <td style={td}>{employee?.name ?? employeeId}</td>
                            {months.map((m) => {
                              const key = `${employeeId}:${m}`;
                              const info = cellInfo[key];
                              return (
                                <td
                                  key={m}
                                  style={{ ...td, background: info?.over ? "#fee" : undefined }}
                                >
                                  <input
                                    defaultValue={displayValue(employeeId, m)}
                                    onBlur={(e) => handleCellEdit(employeeId, m, e.target.value)}
                                    style={{ width: 64 }}
                                    title={
                                      info?.over
                                        ? "Over capacity once other projects are counted"
                                        : undefined
                                    }
                                  />
                                  {info?.beforeFirstRate && (
                                    <span
                                      title="This month is before the employee's first rate record — it costs 0 and is flagged"
                                      style={{ color: "#a60", marginLeft: 2 }}
                                    >
                                      *
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {rowEmployeeIds.length === 0 && (
                        <tr>
                          <td style={td} colSpan={months.length + 1}>
                            No one is staffed on this item yet -- use "+ Add person".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {overCapacityNotes.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#a11" }}>
                    {overCapacityNotes.map((n) => (
                      <div key={n.key}>† {n.text}</div>
                    ))}
                  </div>
                )}
                <p style={{ marginTop: 6, fontSize: 11, opacity: 0.6 }}>
                  * before the employee's first rate record (costs 0). Edits are flagged, never
                  blocked.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 6, borderBottom: "2px solid #ccc", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: 4, borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
