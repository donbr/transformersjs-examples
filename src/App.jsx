import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './HomePage';

// Dynamic imports for each example
const LlamaDemo = React.lazy(() => import('./demos/llama/App'));
const PhiDemo = React.lazy(() => import('./demos/phi/App'));
const JanusDemo = React.lazy(() => import('./demos/janus/App'));
const FlorenceDemo = React.lazy(() => import('./demos/florence/App'));
const CrossEncoderDemo = React.lazy(() => import('./demos/cross-encoder/App'));
const ZeroShotDemo = React.lazy(() => import('./demos/zero-shot/App'));
const SpeechT5Demo = React.lazy(() => import('./demos/speecht5/App'));
const TTSDemo = React.lazy(() => import('./demos/tts/App'));

function App() {
  // Define header content
  const header = (
    <div className="container mx-auto px-4">
      <Link to="/" className="text-blue-600 hover:text-blue-800 flex items-center h-full py-2">
        ← Back to Examples
      </Link>
    </div>
  );

  return (
    <Layout header={header}>
      <div className="container mx-auto p-4 h-full">
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
            <Route path="/llama" element={<LlamaDemo />} />
            <Route path="/phi" element={<PhiDemo />} />
            <Route path="/janus" element={<JanusDemo />} />
            <Route path="/florence" element={<FlorenceDemo />} />
            <Route path="/cross-encoder" element={<CrossEncoderDemo />} />
            <Route path="/zero-shot" element={<ZeroShotDemo />} />
            <Route path="/speecht5" element={<SpeechT5Demo />} />
            <Route path="/tts" element={<TTSDemo />} />
          </Routes>
        </React.Suspense>
      </div>
    </Layout>
  );
}

export default App;
