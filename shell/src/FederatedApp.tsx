import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { loadFederatedModule } from "./loadRemote";
import { RemoteBoundary } from "./RemoteBoundary";

interface Props {
  remoteName: "people" | "delivery";
  exposedModule: string;
  /** name of the named export on the remote module, e.g. "PeopleApp" */
  exportName: string;
  /** props handed to the remote component -- how Shell pushes its context in */
  moduleProps?: Record<string, unknown>;
}

type RemoteComponent = ComponentType<Record<string, unknown>>;

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; Component: RemoteComponent };

/**
 * Dynamically fetches a remote's exposed module (loading failures --
 * network down, container stopped -- are handled here since React error
 * boundaries don't catch async errors) and renders it wrapped in
 * RemoteBoundary (which catches synchronous errors thrown *within* the
 * remote's own render, e.g. a bug in PeopleApp itself).
 */
export function FederatedApp({ remoteName, exposedModule, exportName, moduleProps }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    loadFederatedModule<Record<string, RemoteComponent>>(remoteName, exposedModule)
      .then((mod) => {
        if (cancelled) return;
        const Component = mod[exportName];
        if (!Component) {
          setState({ status: "error", error: new Error(`"${exportName}" not found on remote "${remoteName}"`) });
          return;
        }
        setState({ status: "ready", Component });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: "error", error });
      });

    return () => {
      cancelled = true;
    };
  }, [remoteName, exposedModule, exportName]);

  if (state.status === "loading") {
    return <div style={{ padding: 32, opacity: 0.6 }}>Loading {remoteName}...</div>;
  }

  if (state.status === "error") {
    return (
      <div
        style={{
          padding: 32,
          border: "1px dashed #c33",
          borderRadius: 8,
          background: "#fff5f5",
          color: "#900",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <strong>"{remoteName}" is unavailable right now.</strong>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {state.error.message}. The rest of the suite is unaffected -- try again shortly, or check{" "}
          <code>docker compose logs {remoteName}</code>.
        </p>
      </div>
    );
  }

  const { Component } = state;
  return (
    <RemoteBoundary remoteName={remoteName}>
      <Component {...(moduleProps ?? {})} />
    </RemoteBoundary>
  );
}
