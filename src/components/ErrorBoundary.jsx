"use client";

import { Component } from "react";
import Icon from "@/components/ui/Icons";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Court IQ Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "var(--color-bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 32,
          paddingRight: 32,
          textAlign: "center",
        }}>
          <div style={{ marginBottom: 16 }}><Icon name="basketball" size={48} color="#FF6B35" /></div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--color-text)", marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-sec)", marginBottom: 24, maxWidth: 300 }}>
            Court IQ hit an unexpected error. Your data is safe — try refreshing.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              maxWidth: 240,
              width: "100%",
              padding: "14px 24px",
              borderRadius: 14,
              border: "none",
              background: "var(--color-accent)",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Refresh App
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={{
              marginTop: 24,
              textAlign: "left",
              fontSize: 10,
              color: "#DC2626",
              background: "rgba(220,38,38,0.05)",
              borderRadius: 12,
              padding: 16,
              maxWidth: "100%",
              overflow: "auto",
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
