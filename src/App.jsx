import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
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
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow p-4">
        <div className="container mx-auto">
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Examples
          </Link>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <React.Suspense fallback={<div className="flex justify-center py-20">Loading example...</div>}>
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
      </main>
    </div>
  );
}

export default App;
