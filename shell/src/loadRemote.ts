import React from "react";
import ReactDOM from "react-dom";
import { init, loadRemote } from "@module-federation/runtime";

let initialized = false;

/**
 * Registers people/delivery as remotes using URLs read from
 * window.__BASELINE_CONFIG__ (injected at container startup -- see
 * docker-entrypoint.sh). This is what satisfies "Remote URLs resolve at
 * runtime from container configuration, never from the bundle": nothing
 * here is baked in at build time, and changing the config file (then
 * restarting the shell container -- no rebuild) points Shell at different
 * People/Delivery deployments.
 *
 * Also declares react/react-dom as singleton shared dependencies so Shell
 * and both remotes end up using the exact same React instance (the dashed
 * line in the spec's topology diagram).
 */
function ensureInitialized() {
  if (initialized) return;

  const config = window.__BASELINE_CONFIG__;
  if (!config?.peopleRemoteEntry || !config?.deliveryRemoteEntry) {
    throw new Error(
      "window.__BASELINE_CONFIG__ is missing remote URLs. Check that /config/env.js loaded before main.tsx."
    );
  }

  init({
    name: "shell",
    remotes: [
      { name: "people", entry: config.peopleRemoteEntry, type: "module" },
      { name: "delivery", entry: config.deliveryRemoteEntry, type: "module" },
    ],
    shared: {
      react: {
        version: "18.3.1",
        lib: () => React,
        shareConfig: { singleton: true, requiredVersion: "^18.3.1" },
      },
      "react-dom": {
        version: "18.3.1",
        lib: () => ReactDOM,
        shareConfig: { singleton: true, requiredVersion: "^18.3.1" },
      },
    },
  });

  initialized = true;
}

/**
 * Loads one exposed module from a remote, e.g. loadFederatedModule("people", "PeopleApp").
 * Throws if the remote's remoteEntry.js can't be fetched or the module
 * isn't exposed -- callers should wrap this in an error boundary
 * (see RemoteBoundary.tsx) so a down remote doesn't take out the whole shell.
 */
export async function loadFederatedModule<T = { default: React.ComponentType }>(
  remoteName: "people" | "delivery",
  exposedModule: string
): Promise<T> {
  ensureInitialized();
  const mod = await loadRemote<T>(`${remoteName}/${exposedModule}`);
  if (!mod) {
    throw new Error(`Remote "${remoteName}" did not expose "${exposedModule}"`);
  }
  return mod;
}
