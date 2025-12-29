import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  userFeedback: string;
  copied: boolean;
}

/**
 * Error Boundary Component
 * Fängt React-Fehler und zeigt Fallback-UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      userFeedback: '',
      copied: false,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Zentrales Logging
    if (window && (window as any).logError) {
      (window as any).logError(error, 'ErrorBoundary', errorInfo);
    } else {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    this.setState({
      error,
      errorInfo,
    });
    // Optional: An Error-Tracking-Service senden (z.B. Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      userFeedback: '',
      copied: false,
    });
    
    // Seite neu laden
    window.location.href = '/';
  };

  // PHASE 3: Error Report Copy-to-Clipboard
  handleCopyErrorReport = async () => {
    const report = {
      timestamp: new Date().toISOString(),
      error: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
      },
      userFeedback: this.state.userFeedback,
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      // Fallback für Browser ohne Clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(report, null, 2);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom Fallback UI wenn vorhanden
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Standard Fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Ein Fehler ist aufgetreten
            </h1>
            
            <p className="text-gray-600 text-center mb-6">
              Entschuldigung, etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 p-4 bg-gray-100 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm text-gray-700 mb-2">
                  Fehlerdetails (nur in Entwicklung sichtbar)
                </summary>
                <div className="text-xs text-gray-600 overflow-auto">
                  <p className="font-bold mb-2">{this.state.error.toString()}</p>
                  <pre className="whitespace-pre-wrap">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}

            {/* PHASE 3: User Feedback for Error Report */}
            <div className="mb-6">
              <label htmlFor="user-feedback" className="block text-sm font-medium text-gray-700 mb-2">
                Was ist passiert? (Optional - hilft uns bei der Fehlersuche)
              </label>
              <textarea
                id="user-feedback"
                rows={3}
                value={this.state.userFeedback}
                onChange={(e) => this.setState({ userFeedback: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="z.B. 'Ich habe auf den Button geklickt und dann...'"
              />
            </div>

            <div className="space-y-3">
              {/* PHASE 3: Copy Error Report Button */}
              <button
                onClick={this.handleCopyErrorReport}
                className={`w-full py-2 px-4 rounded-lg transition font-medium ${
                  this.state.copied
                    ? 'bg-green-600 text-white'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                {this.state.copied ? '✓ Fehlerbericht kopiert!' : '📋 Fehlerbericht kopieren'}
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Zur Startseite
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Seite neu laden
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Wenn das Problem weiterhin besteht, kopieren Sie den Fehlerbericht und kontaktieren Sie den Support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
