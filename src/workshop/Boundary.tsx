import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown instead of the broken part. */
  onBack?: () => void;
}

/** Keeps a crash (or a chunk that failed to load) from leaving the child on a blank page. */
export class Boundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="w-screen gutter">
        <div className="w-wrap">
          <div className="w-message" role="alert">
            <h2>Algo no salió bien</h2>
            <p>Tu trabajo está guardado. Probá de nuevo y, si sigue igual, avisale a tu profe.</p>
            <div className="w-row">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Volver a cargar
              </button>
              {this.props.onBack && (
                <button
                  className="btn"
                  onClick={() => {
                    this.setState({ failed: false });
                    this.props.onBack?.();
                  }}
                >
                  Ir a mis juegos
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }
}
