import { OpenJev } from "open-jev";
import { postError } from "../../utils/workerRuntime.js";
import { buildQuestion, probabilitiesFor } from "./question.js";

const MODEL = "open-jev";
const WARMUP_TEXT = "what is my checking balance";

// q4f16 needs WebGPU with shader-f16; otherwise q4, on WebGPU if present, else WASM.
// The shipped calibration was computed with q4f16 on WebGPU.
async function pickRuntime() {
  let adapter = null;
  try {
    adapter = await self.navigator.gpu?.requestAdapter?.();
  } catch (error) {
    // navigator.gpu can exist while requestAdapter() throws (blocklisted GPU,
    // disabled flag); WASM still works, so fall back instead of failing the load.
    console.warn("[decide] WebGPU adapter request failed; using WASM:", error);
  }
  if (adapter?.features.has("shader-f16")) return { device: "webgpu", dtype: "q4f16" };
  if (adapter) return { device: "webgpu", dtype: "q4" };
  return { device: "wasm", dtype: "q4" };
}

let loading = null;

async function load() {
  const runtime = await pickRuntime();
  const info = await OpenJev.info({ model: MODEL, ...runtime });
  self.postMessage({
    status: "info",
    isCached: info.isCached,
    downloadSize: info.downloadSize,
    ...runtime,
  });

  // open-jev's own `total` only counts files that have started downloading, so
  // it jumps when the large weights file begins. Report bytes against the full
  // download size instead, throttled to whole megabytes.
  let lastMb = -1;
  const instance = await OpenJev.load({
    model: MODEL,
    ...runtime,
    onProgress: ({ loaded }) => {
      const mb = Math.floor(loaded / 1e6);
      if (mb === lastMb) return;
      lastMb = mb;
      self.postMessage({
        status: "progress",
        loaded: Math.min(loaded, info.downloadSize),
        total: info.downloadSize,
      });
    },
  });

  // The first call compiles GPU shaders; do it before reporting ready.
  self.postMessage({ status: "warming" });
  const t0 = performance.now();
  await instance.decide(WARMUP_TEXT, [buildQuestion([{ text: "check a balance", description: "" }, { text: "something else", description: "" }])]);
  self.postMessage({ status: "ready", warmupMs: performance.now() - t0, ...runtime });
  return instance;
}

async function getModel() {
  // Drop a failed load so the next request retries instead of reusing the rejection.
  loading ??= load().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function decide({ id, text, labels }) {
  const model = await getModel();
  const t0 = performance.now();
  const [answer] = await model.decide(text, [buildQuestion(labels)]);
  self.postMessage({
    status: "decision",
    id,
    probs: probabilitiesFor(answer, labels),
    ms: performance.now() - t0,
  });
}

// Re-score calibration tickets with edited labels. Progress is posted every 10
// tickets; the main thread terminates the worker to cancel.
async function calibrate({ runId, texts, labels }) {
  const model = await getModel();
  const question = buildQuestion(labels);
  const probs = [];
  for (const [i, text] of texts.entries()) {
    const [answer] = await model.decide(text, [question]);
    probs.push(probabilitiesFor(answer, labels));
    if ((i + 1) % 10 === 0 || i + 1 === texts.length) {
      self.postMessage({ status: "calibrate-progress", runId, done: i + 1, total: texts.length });
    }
  }
  self.postMessage({ status: "calibrated", runId, probs });
}

self.addEventListener("message", async (event) => {
  try {
    const { type } = event.data;
    if (type === "load") await getModel();
    else if (type === "decide") await decide(event.data);
    else if (type === "calibrate") await calibrate(event.data);
  } catch (error) {
    postError(error);
  }
});
