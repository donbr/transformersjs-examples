// Single source of truth for the demos: the homepage cards and the site header's breadcrumb
// and model chip read this list. Routes stay hand-written in src/App.jsx (React.lazy +
// <Route>), so adding a demo still means adding its route there too.
//
// modelName:   short readable name for the header; modelId is the Hugging Face repo id
//              (used for links and tooltips).
// runtime:     'wasm' | 'webgpu-preferred'
// liveRuntime: the demo page shows the device it actually loaded, so the header shows no
//              runtime pill for it (a static one would duplicate or contradict the page).
// status:      'live' (has a route) | 'planned' (no route yet; homepage card only)
// accent:      Tailwind top-border class for the homepage card (full literal, for JIT)
export const demos = [
  {
    id: 'decide',
    name: 'Decide',
    description:
      "Paste a support ticket and get Auto-route or Escalate. A ticket is only routed automatically when the model's confidence clears a threshold certified for your error target.",
    accent: 'border-blue-500',
    modelName: 'open-jev · DeBERTa-v3-large',
    modelId: 'onnx-community/open-jev-deberta-v3-large-ONNX',
    runtime: 'webgpu-preferred',
    liveRuntime: true,
    status: 'live',
  },
  {
    id: 'cross-encoder',
    name: 'Cross Encoder',
    description: 'Score how relevant each passage is to a query, then rank them. The planned /verify builds on it.',
    accent: 'border-green-500',
    modelName: 'mxbai-rerank-xsmall-v1',
    modelId: 'mixedbread-ai/mxbai-rerank-xsmall-v1',
    runtime: 'wasm',
    status: 'live',
  },
  {
    id: 'zero-shot',
    name: 'Zero-Shot Classification',
    description: 'Sort text into labels you define, with no training. Paste reviews and watch them land in sections.',
    accent: 'border-green-500',
    modelName: 'deberta-v3-xsmall-zeroshot',
    modelId: 'MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33',
    runtime: 'wasm',
    status: 'live',
  },
  {
    id: 'verify',
    name: 'Verify',
    description:
      'Is this quote or citation actually supported by its source? Exact match first, then a small NLI model returns supports, contradicts or not mentioned.',
    detail: '/verify · extends Cross Encoder',
    accent: 'border-purple-500',
    status: 'planned',
  },
  {
    id: 'guard',
    name: 'Guard',
    description:
      'Offline prompt-injection and policy check for LLM inputs and outputs, with strict and permissive policies you can switch between.',
    detail: '/guard · Llama Prompt Guard 2 (22M)',
    accent: 'border-amber-500',
    status: 'planned',
  },
  {
    id: 'redact',
    name: 'Redact',
    description: 'Strip PII on-device before text is sent to an LLM.',
    detail: '/redact',
    accent: 'border-pink-500',
    status: 'planned',
    optional: true,
  },
];

export const liveDemos = demos.filter((demo) => demo.status === 'live');
export const plannedDemos = demos.filter((demo) => demo.status === 'planned');

/** The live demo whose route matches a pathname such as "/decide", or undefined. */
export function demoForPath(pathname) {
  const id = pathname.replace(/^\/+|\/+$/g, '');
  return liveDemos.find((demo) => demo.id === id);
}

// Static runtime pill, shown only for demos without liveRuntime.
export const runtimeLabel = (runtime) => (runtime === 'wasm' ? 'WASM' : 'WebGPU');
export const modelUrl = (demo) => `https://huggingface.co/${demo.modelId}`;
