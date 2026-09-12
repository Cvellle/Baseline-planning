import { useMemo, useState } from "react";
import { Employee, CapacityFlag } from "./api";

interface Props {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  overByEmployee: Map<string, CapacityFlag[]>;
}

export function EmployeeList({ employees, selectedId, onSelect, overByEmployee }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.role.toLowerCase().includes(search.toLowerCase())
      ),
    [employees, search]
  );

  return (
    <div>
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
              onClick={() => onSelect(e.id)}
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
  );
}
