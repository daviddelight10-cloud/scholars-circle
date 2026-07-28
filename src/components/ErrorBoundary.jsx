import React, { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          padding: "40px",
          textAlign: "center",
          background: "var(--card-bg, #1e293b)",
          borderRadius: "12px",
          border: "1px solid var(--border-color, #334155)",
        }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ color: "var(--text-primary, #f1f5f9)", marginBottom: "12px" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-secondary, #cbd5e1)", marginBottom: "24px", maxWidth: "400px" }}>
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          {this.state.error && (
            <details style={{
              marginBottom: "24px",
              textAlign: "left",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "16px",
              maxWidth: "500px",
            }}>
              <summary style={{ color: "#ef4444", cursor: "pointer", marginBottom: "8px" }}>
                Error Details
              </summary>
              <pre style={{
                color: "var(--text-secondary, #cbd5e1)",
                fontSize: "12px",
                overflow: "auto",
                maxHeight: "200px",
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              background: "var(--accent-color, #FFD700)",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
