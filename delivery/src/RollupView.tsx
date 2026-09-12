import { DisplayUnit, DisplayCurrency } from "@baseline/domain";
import { RollupResult } from "./api";
import { fmt } from "./format";
import { shortMonth } from "./months";
import { th, td } from "./tableStyles";

interface Props {
  rollup: RollupResult | null;
  unit: DisplayUnit;
  currency: DisplayCurrency;
}

export function RollupView({ rollup, unit, currency }: Props) {
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
                    {fmt(r.byMonth[m] ?? 0, unit, currency)}
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
                  {fmt(r.rowTotal, unit, currency)}
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
                  {fmt(rollup.columnTotals[m] ?? 0, unit, currency)}
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
                {fmt(rollup.grandTotal, unit, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
