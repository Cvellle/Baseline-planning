interface WorkItem {
  id: string;
  name: string;
}

const WORK_ITEMS: WorkItem[] = [{ id: "w1", name: "Baseline redesign" }];

const MONTHS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
];

// Static placeholder hours: work item -> month -> hours.
const ALLOCATIONS: Record<string, Record<string, number>> = {
  w1: { "2026-01": 80, "2026-02": 80, "2026-03": 40 },
};

export function DeliveryApp() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Delivery</h1>

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 8 }}>
        Work breakdown
      </h2>
      <ul style={{ paddingLeft: 20 }}>
        {WORK_ITEMS.map((w) => (
          <li key={w.id}>{w.name}</li>
        ))}
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 8 }}>
        Staffing grid
      </h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Work item</th>
            {MONTHS.map((m) => (
              <th key={m} style={th}>
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WORK_ITEMS.map((w) => (
            <tr key={w.id}>
              <td style={td}>{w.name}</td>
              {MONTHS.map((m) => (
                <td key={m} style={td}>
                  {ALLOCATIONS[w.id]?.[m] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 8,
  borderBottom: "2px solid #ccc",
};
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #eee" };
