import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// Standalone: `npm run dev` / `npm run preview` serves this app on its own,
// full page, with no Shell involved -- this is the "standalone" half of
// "standalone and hosted from one build" (see README).
//
// Hosted: the same build also emits remoteEntry.js exposing PeopleApp,
// which Shell loads dynamically at runtime (see shell/src/loadRemote.ts).
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "people",
      filename: "remoteEntry.js",
      exposes: {
        "./PeopleApp": "./src/PeopleApp.tsx",
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
    port: 5174,
    cors: true,
  },
  preview: {
    port: 5174,
    cors: true,
  },
});
