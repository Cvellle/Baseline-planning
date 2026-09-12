import { useState } from "react";
import { formatMoney, convertFromEur, convertToEur, type DisplayCurrency } from "@baseline/domain";
import { Employee, RateRecord, CapacityFlag } from "./api";
import { th, td } from "./tableStyles";

interface Props {
  employee: Employee;
  currency: DisplayCurrency;
  rates: RateRecord[];
  over: CapacityFlag[];
  onAddRate: (validFrom: string, hourlyCost: number) => Promise<void>;
  onEditRate: (rate: RateRecord, hourlyCost: number) => Promise<void>;
  onDeleteRate: (rate: RateRecord) => Promise<void>;
}

export function RateHistoryPanel({ employee, currency, rates, over, onAddRate, onEditRate, onDeleteRate }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>{employee.name}</h2>
      <div style={{ opacity: 0.7, marginBottom: 16 }}>
        {employee.role} -- {employee.weeklyHours}h/week
      </div>

      {over.length > 0 && (
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
          <strong>Oversubscribed.</strong> Allocations across all projects exceed 100% of capacity in:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {over.map((f) => (
              <li key={f.month}>
                {f.month} — {f.totalAllocatedHours.toFixed(1)}h allocated vs {f.capacityHours.toFixed(1)}h
                capacity
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
              <RateRow key={r.id} rate={r} currency={currency} onEditRate={onEditRate} onDeleteRate={onDeleteRate} />
            ))}
        </tbody>
      </table>

      {adding ? (
        <AddRateForm
          currency={currency}
          onAdd={async (validFrom, hourlyCost) => {
            await onAddRate(validFrom, hourlyCost);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
          + Add rate (retroactive dates allowed)
        </button>
      )}
    </div>
  );
}

function RateRow({
  rate,
  currency,
  onEditRate,
  onDeleteRate,
}: {
  rate: RateRecord;
  currency: DisplayCurrency;
  onEditRate: (rate: RateRecord, hourlyCost: number) => Promise<void>;
  onDeleteRate: (rate: RateRecord) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  // Edited in the Shell's display currency (what's on screen); converted
  // back to the canonical EUR the rate is stored in on save.
  const [hourlyCost, setHourlyCost] = useState(() => convertFromEur(rate.hourlyCost, currency).toFixed(2));

  function startEdit() {
    setHourlyCost(convertFromEur(rate.hourlyCost, currency).toFixed(2));
    setMode("edit");
  }

  async function submitEdit() {
    const value = Number(hourlyCost);
    if (Number.isNaN(value)) return;
    await onEditRate(rate, convertToEur(value, currency));
    setMode("view");
  }

  async function submitDelete() {
    await onDeleteRate(rate);
  }

  return (
    <tr>
      <td style={td}>{rate.validFrom}</td>
      <td style={td}>
        {mode === "edit" ? (
          <>
            <input
              autoFocus
              type="number"
              step="0.01"
              value={hourlyCost}
              onChange={(e) => setHourlyCost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") setMode("view");
              }}
              style={{ width: 100 }}
            />
            <span style={{ opacity: 0.5, fontSize: 12 }}> {currency}/h</span>
          </>
        ) : (
          <>
            {formatMoney(rate.hourlyCost, currency)}/h
            {currency !== "EUR" && (
              <span style={{ opacity: 0.5, fontSize: 12 }}> (€{rate.hourlyCost.toFixed(2)})</span>
            )}
          </>
        )}
      </td>
      <td style={td}>
        {mode === "view" && (
          <>
            <button onClick={startEdit} style={{ marginRight: 8 }}>
              Edit
            </button>
            <button onClick={() => setMode("delete")}>Remove</button>
          </>
        )}
        {mode === "edit" && (
          <>
            <button onClick={submitEdit} style={{ marginRight: 8 }}>
              Save
            </button>
            <button onClick={() => setMode("view")}>Cancel</button>
          </>
        )}
        {mode === "delete" && (
          <span style={{ fontSize: 13 }}>
            Remove this rate?{" "}
            <button onClick={submitDelete} style={{ marginRight: 8 }}>
              Yes
            </button>
            <button onClick={() => setMode("view")}>No</button>
          </span>
        )}
      </td>
    </tr>
  );
}

function AddRateForm({
  currency,
  onAdd,
  onCancel,
}: {
  currency: DisplayCurrency;
  // hourlyCost passed to onAdd is already converted to canonical EUR.
  onAdd: (validFrom: string, hourlyCost: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [validFrom, setValidFrom] = useState("");
  const [hourlyCost, setHourlyCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!validFrom) return setError("Pick a valid-from date.");
    const value = Number(hourlyCost);
    if (!hourlyCost || Number.isNaN(value)) return setError("Enter a valid hourly cost.");
    setError(null);
    await onAdd(validFrom, convertToEur(value, currency));
  }

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12 }}>
        Valid from{" "}
        <input type="date" autoFocus value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
      </label>
      <label style={{ fontSize: 12 }}>
        Hourly cost ({currency}){" "}
        <input
          type="number"
          step="0.01"
          value={hourlyCost}
          onChange={(e) => setHourlyCost(e.target.value)}
          style={{ width: 90 }}
        />
      </label>
      <button onClick={submit}>Save</button>
      <button onClick={onCancel}>Cancel</button>
      {error && <span style={{ color: "#a11", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
