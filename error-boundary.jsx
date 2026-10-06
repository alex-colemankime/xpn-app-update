import { Component } from "react";
import { LISTEN_URL } from "./links.js";

// A render error anywhere in the tree would otherwise leave a listener with a
// blank page. The stream itself is a plain <audio> element outside React, so
// keep it playing and offer a way back rather than unmounting silently.
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("WXPN app error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-error" role="alert">
        <h1>Something went wrong</h1>
        <p>
          The app hit an unexpected error. Any audio already playing continues; reloading should
          restore the screen.
        </p>
        <div className="app-error-actions">
          <button className="primary-button" onClick={() => window.location.reload()}>
            Reload the app
          </button>
          <a className="text-button" href={LISTEN_URL} target="_blank" rel="noreferrer">
            Listen on xpn.org
          </a>
        </div>
      </div>
    );
  }
}
