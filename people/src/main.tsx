import React from "react";
import ReactDOM from "react-dom/client";
import { PeopleApp } from "./PeopleApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 16 }}>
        Standalone mode -- People is running with no Shell around it.
      </p>
      <PeopleApp />
    </div>
  </React.StrictMode>
);
