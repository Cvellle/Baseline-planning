import { useState } from "react";
import { FederatedApp } from "./FederatedApp";

/**
 * Shell owns the active user and the display currency and pushes both into
 * the remotes at runtime -- as a `shell` prop on the mounted remote
 * component (see FederatedApp). The remotes treat it as read-only context:
 * People renders rates in it, Delivery prices its grid in it. Neither
 * remote owns or mutates it. The string union matches @baseline/domain's
 * DisplayCurrency; Shell keeps its own copy so it needs no domain build.
 */
export type DisplayCurrency = "EUR" | "USD" | "GBP";

export interface ShellContext {
  activeUser: string;
  displayCurrency: DisplayCurrency;
}

const CURRENCIES: DisplayCurrency[] = ["EUR", "USD", "GBP"];

type Tab = "people" | "delivery";

export function App() {
  const [tab, setTab] = useState<Tab>("people");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("EUR");
  const activeUser = "demo@baseline.local"; // stand-in; auth is explicitly out of scope

  const shell: ShellContext = { activeUser, displayCurrency };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <strong>Baseline</strong>
          <nav style={{ display: "flex", gap: 4 }}>
            <TabButton active={tab === "people"} onClick={() => setTab("people")}>
              People
            </TabButton>
            <TabButton active={tab === "delivery"} onClick={() => setTab("delivery")}>
              Delivery
            </TabButton>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <label>
            Currency{" "}
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <span style={{ opacity: 0.6 }}>{activeUser}</span>
        </div>
      </header>

      <main style={{ padding: 24 }}>
        {tab === "people" && (
          <FederatedApp
            remoteName="people"
            exposedModule="PeopleApp"
            exportName="PeopleApp"
            moduleProps={{ shell }}
          />
        )}
        {tab === "delivery" && (
          <FederatedApp
            remoteName="delivery"
            exposedModule="DeliveryApp"
            exportName="DeliveryApp"
            moduleProps={{ shell }}
          />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        border: "none",
        borderRadius: 6,
        background: active ? "#eef" : "transparent",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
