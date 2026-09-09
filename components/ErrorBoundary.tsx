'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-bg px-6">
          <div className="w-full max-w-[420px]">
            <h1 className="text-xl font-semibold text-ink">SPARK stopped unexpectedly.</h1>
            <p className="mt-2 text-prose text-muted">
              Your data and settings are untouched. Reloading usually clears it.
            </p>

            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line-subtle bg-surface p-3 font-mono text-sm text-muted">
              {this.state.error?.message || 'No error message was reported.'}
            </pre>

            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex h-8 items-center rounded-md border border-accent-lo bg-accent px-3.5 text-base font-medium text-accent-ink transition-colors duration-1 ease-out hover:bg-accent-hi"
            >
              Reload SPARK
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;