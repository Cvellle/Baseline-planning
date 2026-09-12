import type { DisplayCurrency } from "@baseline/domain";
import { ShellContext } from "./api";
import { usePeopleData } from "./usePeopleData";
import { EmployeeList } from "./EmployeeList";
import { RateHistoryPanel } from "./RateHistoryPanel";

const STANDALONE_SHELL: ShellContext = { activeUser: "standalone", displayCurrency: "EUR" };

/**
 * This is the module Module Federation exposes as "./PeopleApp" (see
 * vite.config.ts). Shell mounts it with a `shell` prop (active user +
 * display currency); main.tsx mounts it standalone with a default. It must
 * not import anything from Delivery or Shell.
 */
export function PeopleApp({ shell = STANDALONE_SHELL }: { shell?: ShellContext }) {
  const currency: DisplayCurrency = shell.displayCurrency;
  const {
    employees,
    loading,
    selectedId,
    setSelectedId,
    selected,
    rates,
    overByEmployee,
    selectedOver,
    addRate,
    editRate,
    deleteRate,
  } = usePeopleData();

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
        <EmployeeList
          employees={employees}
          selectedId={selectedId}
          onSelect={setSelectedId}
          overByEmployee={overByEmployee}
        />
      </div>

      <div style={{ flex: 1 }}>
        {!selected && <div style={{ opacity: 0.6 }}>Select someone to see their rate history.</div>}
        {selected && (
          <RateHistoryPanel
            employee={selected}
            currency={currency}
            rates={rates}
            over={selectedOver}
            onAddRate={addRate}
            onEditRate={editRate}
            onDeleteRate={deleteRate}
          />
        )}
      </div>
    </div>
  );
}
