import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ViewportHeightFix from './utils/ViewportHeightFix.jsx';
import './index.css';

// A lazy page chunk that fails to load (usually an old tab after a deploy) is retried once by
// reloading. The timestamp guard allows at most one reload a minute, so a real outage falls
// through to RouteErrorBoundary instead of looping.
const RELOAD_KEY = 'preload-error-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return; // no sessionStorage: let the error reach the boundary
  }
  if (Date.now() - last < 60_000) return;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ViewportHeightFix />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
