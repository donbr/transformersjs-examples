// Single source of truth for the demos: the homepage cards and the site header's breadcrumb
// and model chip read this list. Routes stay hand-written in src/App.jsx (React.lazy +
// <Route>), so adding a demo still means adding its route there too.
//
// runtime: 'wasm' | 'webgpu-preferred' (static: the page itself reports the live device)
// status:  'live' (has a route) | 'planned' (no route yet)
export const demos = [
  {
    id: 'decide',
    name: 'Decide',
    description:
      'Auto-route a support ticket only when a calibrated confidence threshold meets your error target; escalate the rest',
    category: 'decisions',
    modelId: 'onnx-community/open-jev-deberta-v3-large-ONNX',
    runtime: 'webgpu-preferred',
    status: 'live',
  },
  {
    id: 'cross-encoder',
    name: 'Cross Encoder',
    description: 'Text similarity and relevance scoring',
    category: 'classification',
    modelId: 'mixedbread-ai/mxbai-rerank-xsmall-v1',
    runtime: 'wasm',
    status: 'live',
  },
  {
    id: 'zero-shot',
    name: 'Zero-Shot Classification',
    description: 'Classify text without specific training',
    category: 'classification',
    modelId: 'MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33',
    runtime: 'wasm',
    status: 'live',
  },
];

export const liveDemos = demos.filter((demo) => demo.status === 'live');

/** The live demo whose route matches a pathname such as "/decide", or undefined. */
export function demoForPath(pathname) {
  const id = pathname.replace(/^\/+|\/+$/g, '');
  return liveDemos.find((demo) => demo.id === id);
}

// Static labels: a webgpu-preferred demo falls back to WASM, so its label names both
// (the demo page shows the device it actually picked).
export const runtimeLabel = (runtime) => (runtime === 'wasm' ? 'WASM' : 'WebGPU / WASM');
export const runtimeTitle = (runtime) =>
  runtime === 'wasm' ? 'Runs on WebAssembly' : 'Prefers WebGPU; falls back to WebAssembly';
