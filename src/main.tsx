console.log('[main.tsx] Starting imports...');
import React from 'react';
import ReactDOM from 'react-dom/client';
console.log('[main.tsx] React imported successfully');
import App from './App';
console.log('[main.tsx] App imported successfully');
import './index.css';
console.log('[main.tsx] CSS imported successfully');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fee', padding: '10px' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
