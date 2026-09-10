import React from "react";

interface Props {
  remoteName: string;
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Wraps a lazily-loaded remote. If loading or rendering the remote throws
 * (network failure, remote container down, exposed module missing), this
 * shows a fallback panel in place of that panel instead of taking down the
 * rest of the shell -- satisfies "If a remote fails to load, the shell
 * stays alive and says so in place of that panel."
 *
 * To trigger this on purpose for the demo: `docker compose stop people`
 * (or delivery), then navigate to that tab in Shell.
 */
export class RemoteBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[shell] "${this.props.remoteName}" remote failed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
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
          <strong>"{this.props.remoteName}" is unavailable right now.</strong>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            The rest of the suite is unaffected. This is expected if that container is stopped
            or unreachable -- try again shortly, or check <code>docker compose logs {this.props.remoteName}</code>.
          </p>
          <button onClick={() => this.setState({ hasError: false, error: undefined })} style={{ marginTop: 8 }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
