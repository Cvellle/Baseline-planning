import React from "react";
import ReactDOM from "react-dom/client";
import { DeliveryApp } from "./DeliveryApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 16 }}>
        Standalone mode -- Delivery is running with no Shell around it.
      </p>
      <DeliveryApp />
    </div>
  </React.StrictMode>
);
