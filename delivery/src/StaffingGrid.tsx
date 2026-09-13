import { useState } from "react";
import { BreakdownItem, Employee } from "./api";
import { CellInfo } from "./useDeliveryData";
import { shortMonth } from "./months";
import { th, td } from "./tableStyles";
import { btn } from "./buttonStyles";

interface Props {
  selectedItem: BreakdownItem | undefined;
  months: string[];
  rowEmployeeIds: string[];
  employees: Employee[];
  cellInfo: Record<string, CellInfo>;
  displayValue: (employeeId: string, month: string) => string;
  overCapacityNotes: { key: string; text: string }[];
  onAddEmployeeRow: (employeeId: string) => void;
  onCellEdit: (employeeId: string, month: string, rawValue: string) => void;
}

export function StaffingGrid({
  selectedItem,
  months,
  rowEmployeeIds,
  employees,
  cellInfo,
  displayValue,
  overCapacityNotes,
  onAddEmployeeRow,
  onCellEdit,
}: Props) {
  const [addingPerson, setAddingPerson] = useState(false);

  if (!selectedItem) {
    return <div style={{ opacity: 0.6 }}>Select a leaf item to open its staffing grid.</div>;
  }

  const available = employees.filter((e) => !rowEmployeeIds.includes(e.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>{selectedItem.name}</strong>
        {addingPerson ? (
          <AddPersonForm
            employees={available}
            onAdd={(employeeId) => {
              onAddEmployeeRow(employeeId);
              setAddingPerson(false);
            }}
            onCancel={() => setAddingPerson(false)}
          />
        ) : (
          <button onClick={() => setAddingPerson(true)} disabled={available.length === 0} style={btn}>
            + Add person
          </button>
        )}
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
                      <td key={m} style={{ ...td, background: info?.over ? "#fee" : undefined }}>
                        <input
                          defaultValue={displayValue(employeeId, m)}
                          onBlur={(e) => onCellEdit(employeeId, m, e.target.value)}
                          style={{ width: 64 }}
                          title={info?.over ? "Over capacity once other projects are counted" : undefined}
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
        * before the employee's first rate record (costs 0). Edits are flagged, never blocked.
      </p>
    </div>
  );
}

function AddPersonForm({
  employees,
  onAdd,
  onCancel,
}: {
  employees: Employee[];
  onAdd: (employeeId: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(employees[0]?.id ?? "");
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select autoFocus value={value} onChange={(e) => setValue(e.target.value)}>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <button onClick={() => value && onAdd(value)} disabled={!value} style={btn}>
        Add
      </button>
      <button onClick={onCancel} style={btn}>Cancel</button>
    </span>
  );
}
