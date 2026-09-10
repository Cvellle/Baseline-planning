import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "delivery",
      filename: "remoteEntry.js",
      exposes: {
        "./DeliveryApp": "./src/DeliveryApp.tsx",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "^18.3.1" },
      },
    }),
  ],
  build: {
    target: "esnext",
    modulePreload: false,
    cssCodeSplit: false,
  },
  server: {
    port: 5175,
    cors: true,
  },
  preview: {
    port: 5175,
    cors: true,
  },
});
