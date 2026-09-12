import { useEffect, useMemo, useState } from "react";
import { formatMoney, type DisplayCurrency } from "@baseline/domain";
import { api, Employee, RateRecord, CapacityFlag, ShellContext } from "./api";

const STANDALONE_SHELL: ShellContext = { activeUser: "standalone", displayCurrency: "EUR" };

/**
 * This is the module Module Federation exposes as "./PeopleApp" (see
 * vite.config.ts). Shell mounts it with a `shell` prop (active user +
 * display currency); main.tsx mounts it standalone with a default. It must
 * not import anything from Delivery or Shell.
 */
export function PeopleApp({ shell = STANDALONE_SHELL }: { shell?: ShellContext }) {
  const currency: DisplayCurrency = shell.displayCurrency;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rates, setRates] = useState<RateRecord[]>([]);
  const [capacityFlags, setCapacityFlags] = useState<CapacityFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listEmployees().then((list) => {
      setEmployees(list);
      setLoading(false);
    });
    api.listCapacityFlags().then(setCapacityFlags);
  }, []);

  useEffect(() => {
    // Cross-app propagation, no reload: a rate for the open employee changing
    // elsewhere refreshes it live; any allocation edit (in Delivery) can
    // change who is oversubscribed, so re-pull the capacity flags too.
    return api.subscribe((msg) => {
      if (msg.type === "rate.changed" && selectedId && msg.payload.employeeId === selectedId) {
        api.listRates(selectedId).then(setRates);
      }
      if (msg.type === "allocation.changed" || msg.type === "reset") {
        api.listCapacityFlags().then(setCapacityFlags);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) api.listRates(selectedId).then(setRates);
  }, [selectedId]);

  const filtered = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.role.toLowerCase().includes(search.toLowerCase())
      ),
    [employees, search]
  );

  // employeeId -> that person's over-capacity months (R5: oversubscribed in People)
  const overByEmployee = useMemo(() => {
    const map = new Map<string, CapacityFlag[]>();
    for (const f of capacityFlags) {
      const list = map.get(f.employeeId) ?? [];
      list.push(f);
      map.set(f.employeeId, list);
    }
    return map;
  }, [capacityFlags]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const selectedOver = selectedId ? overByEmployee.get(selectedId) ?? [] : [];

  async function handleAddRate() {
    if (!selectedId) return;
    const validFrom = prompt("New rate valid from (YYYY-MM-DD)?");
    if (!validFrom) return;
    const hourlyCostStr = prompt("Hourly cost in EUR (the canonical currency)?");
    if (!hourlyCostStr) return;
    await api.addRate(selectedId, validFrom, Number(hourlyCostStr));
    setRates(await api.listRates(selectedId));
  }

  async function handleEditRate(rate: RateRecord) {
    const hourlyCostStr = prompt("New hourly cost in EUR?", String(rate.hourlyCost));
    if (hourlyCostStr === null) return;
    await api.updateRate(rate.id, { hourlyCost: Number(hourlyCostStr) });
    setRates(await api.listRates(selectedId!));
  }

  async function handleDeleteRate(rate: RateRecord) {
    if (!confirm(`Remove the rate starting ${rate.validFrom}?`)) return;
    await api.deleteRate(rate.id);
    setRates(await api.listRates(selectedId!));
  }

  if (loading) return <div>Loading employees...</div>;

  return (
    <div style={{ display: "flex", gap: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ flex: "0 0 320px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>People</h2>
          <span style={{ fontSize: 11, opacity: 0.55 }}>
            {shell.activeUser} · {currency}
          </span>
        </div>
        <input
          placeholder="Search name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <div style={{ maxHeight: 480, overflowY: "auto", border: "1px solid #ddd" }}>
          {filtered.map((e) => {
            const over = overByEmployee.get(e.id);
            return (
              <div
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: e.id === selectedId ? "#eef" : "transparent",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{e.name}</span>
                  {over && (
                    <span
                      title={`Over capacity in ${over.length} month(s): ${over.map((f) => f.month).join(", ")}`}
                      style={{ color: "#a11", fontSize: 12, whiteSpace: "nowrap" }}
                    >
                      ⚠ over capacity
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {e.role} -- {e.weeklyHours}h/week
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 12, opacity: 0.6 }}>No matches.</div>}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {!selected && <div style={{ opacity: 0.6 }}>Select someone to see their rate history.</div>}
        {selected && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>{selected.name}</h2>
            <div style={{ opacity: 0.7, marginBottom: 16 }}>
              {selected.role} -- {selected.weeklyHours}h/week
            </div>

            {selectedOver.length > 0 && (
              <div
                style={{
                  border: "1px solid #e0b4b4",
                  background: "#fff5f5",
                  color: "#900",
                  borderRadius: 6,
                  padding: "8px 12px",
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <strong>Oversubscribed.</strong> Allocations across all projects exceed 100% of
                capacity in:
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {selectedOver.map((f) => (
                    <li key={f.month}>
                      {f.month} — {f.totalAllocatedHours.toFixed(1)}h allocated vs{" "}
                      {f.capacityHours.toFixed(1)}h capacity
                      {f.breakdownItemName ? ` (latest edit: ${f.breakdownItemName})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Valid from</th>
                  <th style={th}>Hourly cost ({currency})</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {[...rates]
                  .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
                  .map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.validFrom}</td>
                      <td style={td}>
                        {formatMoney(r.hourlyCost, currency)}/h
                        {currency !== "EUR" && (
                          <span style={{ opacity: 0.5, fontSize: 12 }}> (€{r.hourlyCost.toFixed(2)})</span>
                        )}
                      </td>
                      <td style={td}>
                        <button onClick={() => handleEditRate(r)} style={{ marginRight: 8 }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteRate(r)}>Remove</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <button onClick={handleAddRate} style={{ marginTop: 12 }}>
              + Add rate (retroactive dates allowed)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 8, borderBottom: "2px solid #ccc" };
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #eee" };
