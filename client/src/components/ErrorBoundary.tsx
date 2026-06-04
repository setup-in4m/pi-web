import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRecover?: () => void;
  onReopen?: () => void;
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

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[ErrorBoundary]", error.message, errorInfo?.componentStack || "");
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReopen = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReopen?.();
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRecover?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-4 text-[var(--color-t3)]">
          <span className="text-2xl opacity-25">⚠</span>
          <span className="text-xs font-medium text-[var(--color-t2)]">Something went wrong</span>
          <span className="text-[10px] max-w-[250px] leading-relaxed">
            {this.state.error?.message || "Unknown error"}
          </span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 rounded text-[10px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Dismiss
            </button>
            {this.props.onReopen && (
              <button
                onClick={this.handleReopen}
                className="px-3 py-1 rounded text-[10px] font-medium border border-[var(--color-bdl)] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
              >
                Reopen session
              </button>
            )}
            {this.props.onRecover && (
              <button
                onClick={this.handleRecover}
                className="px-3 py-1 rounded text-[10px] font-medium border border-[var(--color-bdl)] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
              >
                Reload panel
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
