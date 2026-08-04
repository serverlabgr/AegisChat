import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

/** Catches render crashes so the whole WebView doesn't go white. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Aegis UI crash:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <div className="error-boundary">
          <h1 className="error-boundary__title">
            {this.props.fallbackTitle ?? "Κάτι πήγε στραβά"}
          </h1>
          <p className="error-boundary__body">
            Το UI κόλλησε σε σφάλμα. Μπορείς να ξαναδοκιμάσεις χωρίς να κλείσεις
            την εφαρμογή.
          </p>
          <pre className="error-boundary__detail">
            {error.message || String(error)}
          </pre>
          <div className="error-boundary__actions">
            <button type="button" className="btn btn--primary" onClick={this.reset}>
              Ξανά
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => window.location.reload()}
            >
              Επανεκκίνηση
            </button>
          </div>
        </div>
      </div>
    );
  }
}
