interface Employee {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
}

const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Ana Petrovic", role: "Engineer", weeklyHours: 40 },
];

export function PeopleApp() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>People</h1>

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 8 }}>
        Employee list
      </h2>
      <ul style={{ paddingLeft: 20 }}>
        {EMPLOYEES.map((e) => (
          <li key={e.id}>
            {e.name} — {e.role}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 8 }}>Register</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Role</th>
            <th style={th}>Weekly hours</th>
          </tr>
        </thead>
        <tbody>
          {EMPLOYEES.map((e) => (
            <tr key={e.id}>
              <td style={td}>{e.name}</td>
              <td style={td}>{e.role}</td>
              <td style={td}>{e.weeklyHours}</td>
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
