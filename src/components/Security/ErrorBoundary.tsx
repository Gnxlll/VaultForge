import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // In a highly secure app, we DO NOT log the error contents to external services
    // as it might contain sensitive vault data. We just wipe it.
    console.error("UI_CRASH_PREVENTED_LEAK");
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 border-[10px] border-red-900">
          <AlertTriangle className="text-red-500 w-24 h-24 mb-6 animate-pulse" />
          <h1 className="text-3xl font-heading text-red-500 tracking-widest mb-4">
            FATAL SYSTEM EXCEPTION
          </h1>
          <p className="text-gray-400 font-mono text-center max-w-lg mb-8">
            The user interface encountered a critical memory fault. To protect
            your data, the view has been terminated and memory has been
            isolated.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center space-x-3 bg-red-900/20 border border-red-500 text-red-500 px-6 py-3 hover:bg-red-500 hover:text-black transition-colors"
          >
            <RefreshCw size={20} />
            <span className="font-heading uppercase tracking-wider font-bold">
              Reboot Interface
            </span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
