import { useState } from "react";
import { DisplayUnit, DisplayCurrency } from "@baseline/domain";
import { ShellContext } from "./api";
import { useDeliveryData } from "./useDeliveryData";
import { getUnitOptions } from "./format";
import { BreakdownTree } from "./BreakdownTree";
import { RollupView } from "./RollupView";
import { StaffingGrid } from "./StaffingGrid";
import { AddItemForm } from "./AddItemForm";

/**
 * This is the module Module Federation exposes as "./DeliveryApp" (see
 * vite.config.ts). It never imports from People directly -- the only thing
 * the two apps share is the @baseline/domain calculation package and the
 * REST/SSE contract exposed by the api service. See README for why.
 *
 * Shell mounts it with a `shell` prop (active user + display currency);
 * main.tsx mounts it standalone with a default. Data loading, mutation
 * handlers and calculation glue live in useDeliveryData; this component
 * just wires that hook to the roll-up / tree / grid views.
 */

const STANDALONE_SHELL: ShellContext = { activeUser: "standalone", displayCurrency: "EUR" };

export function DeliveryApp({ shell = STANDALONE_SHELL }: { shell?: ShellContext }) {
  const currency: DisplayCurrency = shell.displayCurrency;
  const [unit, setUnit] = useState<DisplayUnit>("personMonths");
  const [view, setView] = useState<"grid" | "rollup">("rollup");
  const [addingRoot, setAddingRoot] = useState(false);

  const {
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
  } = useDeliveryData(currency, unit);

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
          {getUnitOptions(currency).map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      {view === "rollup" && <RollupView rollup={rollup} unit={unit} currency={currency} />}

      {view === "grid" && (
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: "0 0 320px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Work breakdown</strong>
              {addingRoot ? (
                <AddItemForm onAdd={(name) => handleAddChild(null, name)} onDone={() => setAddingRoot(false)} />
              ) : (
                <button onClick={() => setAddingRoot(true)}>+ Root item</button>
              )}
            </div>
            <div style={{ marginTop: 8, maxHeight: 480, overflowY: "auto" }}>
              <BreakdownTree
                items={items}
                parentId={null}
                depth={0}
                selectedItemId={selectedItemId}
                isLeaf={isLeaf}
                onSelect={setSelectedItemId}
                onAddChild={handleAddChild}
                onRename={handleRename}
                onMove={handleMove}
                onDelete={handleDelete}
              />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <StaffingGrid
              selectedItem={items.find((i) => i.id === selectedItemId)}
              months={months}
              rowEmployeeIds={rowEmployeeIds}
              employees={employees}
              cellInfo={cellInfo}
              displayValue={displayValue}
              overCapacityNotes={overCapacityNotes}
              onAddEmployeeRow={handleAddEmployeeRow}
              onCellEdit={handleCellEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
