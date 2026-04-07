import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { offlineDB } from "@/lib/offline/db";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  // Clears every cache layer and hard-reloads. Use when the crash is likely
  // caused by stale or malformed persisted data (e.g. after a deployment that
  // changed a data shape). This is the last-resort "never show a frozen page"
  // recovery path.
  clearCacheAndReload = async () => {
    try {
      queryClient.clear();
      await offlineDB.kv_store.delete("rq-cache");
    } catch {
      // Non-fatal — proceed to reload regardless
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            An unexpected error occurred while rendering this page.
          </p>
          {this.state.error && (
            <pre className="mt-3 rounded-lg bg-muted px-4 py-2 text-xs text-left max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-col gap-2 items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={this.reset}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Go to Dashboard
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={this.clearCacheAndReload}
            >
              Clear cache &amp; reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
