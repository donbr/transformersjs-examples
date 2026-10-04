import React from 'react';
import { primaryButton } from './ui/buttons.js';

// Catches a page that fails to render or load, most often a lazy demo chunk that no longer
// exists after a deploy (an old tab asking for an old hash). Layout keys it on the path, so
// navigating to another page clears the error; the header stays usable throughout.
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[route] page failed to render:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div role="alert" className="bg-white rounded-lg shadow-md border-t-4 border-red-500 p-6 flex flex-col gap-3 max-w-prose">
          <h1 className="text-xl font-semibold text-gray-800">This page couldn&apos;t load</h1>
          <p className="text-gray-700">
            The site may have been updated since this tab was opened, or the network dropped. Reloading usually
            fixes it.
          </p>
          <div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${primaryButton} px-6 py-2`}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
