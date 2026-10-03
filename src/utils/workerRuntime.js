import { env } from "@huggingface/transformers";
// The standalone ONNX Runtime files, emitted next to the worker as same-origin assets.
// They resolve to the onnxruntime-web copy transformers.js depends on, so their
// version always matches the runtime API bundled into the worker.
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";

// transformers.js points ONNX Runtime at jsDelivr for its .mjs factory and .wasm
// binary. Serve both from our own origin instead. Both must be set: without an .mjs
// path ONNX Runtime falls back to the factory embedded in its bundle, whose
// multi-threaded build (under cross-origin isolation) spawns its pthread workers
// from `import.meta.url`, i.e. our whole worker bundle. Each thread would then run
// the demo's message handler, reload the model, and can crash the worker.
// Safari < 26 without WebGPU gets a non-asyncify build that is not emitted here, so
// that case stays on the CDN.
const onnxWasm = env.backends.onnx?.wasm;
if (onnxWasm?.wasmPaths?.wasm?.endsWith(".asyncify.wasm")) {
  onnxWasm.wasmPaths = {
    mjs: new URL(ortMjsUrl, import.meta.url).href,
    wasm: new URL(ortWasmUrl, import.meta.url).href,
  };
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
