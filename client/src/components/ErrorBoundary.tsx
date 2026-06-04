import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-4 text-[var(--color-t3)]">
          <span className="text-2xl opacity-25">⚠</span>
          <span className="text-xs font-medium text-[var(--color-t2)]">Something broke</span>
          <span className="text-[10px] max-w-[250px] leading-relaxed">
            {this.state.error?.message || "Unknown error"}
          </span>
          <button
            onClick={this.handleRetry}
            className="mt-1 px-3 py-1 rounded text-[10px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
