import { env } from "@huggingface/transformers";

// transformers.js points ONNX Runtime at jsDelivr for its wasm binary, while Vite
// already bundles the same asyncify build next to the worker. Clearing wasmPaths
// lets ONNX Runtime load that same-origin copy instead. Safari < 26 without WebGPU
// gets a non-asyncify build that Vite does not emit, so that case stays on the CDN.
const onnxWasm = env.backends.onnx?.wasm;
if (onnxWasm?.wasmPaths?.wasm?.endsWith(".asyncify.wasm")) {
  onnxWasm.wasmPaths = undefined;
}

// The UIs only react to these model-loading events. Forwarding every `progress`
// and `progress_total` event would post (and clone) one message per downloaded chunk.
const FORWARDED_PROGRESS = new Set(["initiate", "done", "ready"]);

export function forwardProgress(event) {
  if (FORWARDED_PROGRESS.has(event.status)) {
    self.postMessage(event);
  }
}

// Report a failed load or inference to the main thread so the UI can recover.
export function postError(error) {
  self.postMessage({ status: "error", error: error?.message ?? String(error) });
}
