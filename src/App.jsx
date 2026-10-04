import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './HomePage';
import SiteHeader from './SiteHeader';

// Dynamic imports for each example
const CrossEncoderDemo = React.lazy(() => import('./demos/cross-encoder/App'));
const ZeroShotDemo = React.lazy(() => import('./demos/zero-shot/App'));
const DecideDemo = React.lazy(() => import('./demos/decide/App'));

function App() {
  // The homepage draws full-width bands and its own footer; demos keep the padded container.
  // Only the wrapper's className changes between routes, never the element, so nothing remounts.
  const isHome = useLocation().pathname === '/';
  // Routes and lazy imports stay fixed here (demo metadata lives in demos/registry.js), so
  // header state such as the mobile menu can never re-key or remount a demo and its worker.
  return (
    <Layout header={<SiteHeader />}>
      <div className={isHome ? 'min-h-full flex flex-col' : 'container mx-auto p-4 h-full'}>
        <React.Suspense fallback={
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <div>Loading example...</div>
            </div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cross-encoder" element={<CrossEncoderDemo />} />
            <Route path="/zero-shot" element={<ZeroShotDemo />} />
            <Route path="/decide" element={<DecideDemo />} />
          </Routes>
        </React.Suspense>
      </div>
    </Layout>
  );
}

export default App;
