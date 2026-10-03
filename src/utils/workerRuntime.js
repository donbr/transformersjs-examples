import { env } from "@huggingface/transformers";

// transformers.js points ONNX Runtime at jsDelivr for its wasm binary, while Vite
// already bundles the same asyncify build next to the worker. Clearing wasmPaths
// lets ONNX Runtime load that same-origin copy instead, using the factory embedded
// in its bundle (no .mjs request). This also skips transformers.js's own wasm cache
// pre-load, so the binary relies on HTTP caching of /assets (see vercel.json).
// Safari < 26 without WebGPU gets a non-asyncify build that Vite does not emit, so
// that case stays on the CDN.
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
// The full error (with stack) only exists here, so log it in the worker console.
export function postError(error) {
  console.error("[worker] load or inference failed:", error);
  // Empty messages and non-Error throws (Emscripten can throw a bare number)
  // would otherwise render as blank or meaningless text.
  const message =
    (error instanceof Error && error.message) ||
    (typeof error === "string" && error) ||
    "Unexpected error in the model worker (see the console for details).";
  self.postMessage({ status: "error", error: message });
}
