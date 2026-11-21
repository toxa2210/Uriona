import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[URIONA_FATAL_RENDER_ERROR]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f5f1", color: "#171717", fontFamily: "Arial, sans-serif" }}>
          <section style={{ width: "min(100%, 560px)", padding: 28, background: "#fff", border: "1px solid #e8e4de" }}>
            <strong style={{ color: "#f05a28", letterSpacing: ".12em" }}>URIONA</strong>
            <h1 style={{ margin: "18px 0 8px", fontSize: 24 }}>Возникла ошибка приложения</h1>
            <p style={{ color: "#666", lineHeight: 1.5 }}>Мы зафиксировали сбой интерфейса. Обновите страницу. Если ошибка повторится, отправьте поддержке текст ниже.</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 12, background: "#f7f5f1", fontSize: 12 }}>{this.state.error.message}</pre>
            <button onClick={() => window.location.reload()} style={{ border: 0, padding: "12px 18px", background: "#f05a28", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Обновить страницу</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
