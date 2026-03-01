import React from "react";

interface Props {
  title: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: undefined,
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[PageErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-6">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              {this.props.title}
            </h3>
            <p className="mt-2 text-sm text-red-700/90 dark:text-red-300/90 break-all">
              {this.state.errorMessage || "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
