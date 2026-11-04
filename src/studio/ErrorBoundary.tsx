import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Called when the child picks «Seguir»: the parent remounts the studio from the last save. */
  onContinue: () => void;
  onExit: () => void;
}

interface State {
  failed: boolean;
}

/** A render error must never blank the page: the child gets a way to carry on. */
export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Studio render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mc-studio mc-crash" role="alert">
        <div className="mc-crash-card">
          <h2>Uy, algo se trabó</h2>
          <p>Tu proyecto está guardado. Tocá «Seguir» para volver a abrirlo.</p>
          <div className="mc-modal-actions">
            <button type="button" className="mc-mbtn primary" onClick={() => { this.setState({ failed: false }); this.props.onContinue(); }}>Seguir</button>
            <button type="button" className="mc-mbtn" onClick={this.props.onExit}>Salir</button>
          </div>
        </div>
      </div>
    );
  }
}
