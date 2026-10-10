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

// One screen's share of the same: its code couldn't load (the connection
// dropped, on the web) or it failed to draw. The other screens, the player
// and the tab bar carry on; reloading brings it back.
export class ScreenErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen-error" role="alert">
        <p>This screen didn’t load. Check your connection, then reload the app.</p>
        <button className="secondary-button" onClick={() => window.location.reload()}>
          Reload the app
        </button>
      </div>
    );
  }
}

// For something laid over the app (the welcome, the watch page): if its code
// can't load or it fails to draw, it steps aside and `onError` says so, and
// the app underneath carries on. Keyed by its caller so it can try again.
export class OverlayErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
