# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single React + Vite SPA that hosts browser-side ML demos adapted from [huggingface/transformers.js-examples](https://github.com/huggingface/transformers.js-examples). All inference runs in the browser via `@huggingface/transformers` v4 (ONNX models fetched from the Hugging Face Hub at runtime); there is no backend.

Live routes: `/decide` (support-ticket auto-route vs. escalate with a calibrated confidence threshold; open-jev / DeBERTa-v3-large via the `open-jev` package, ~357 MB q4f16, WebGPU-preferred with WASM fallback), `/zero-shot` (zero-shot classification) and `/cross-encoder` (reranking), both WASM. Planned, not yet built: `/verify` (citation support check, extends cross-encoder), `/guard` (prompt-injection check), optional `/redact` (PII redaction).

## Commands

```bash
npm ci            # install from lockfile
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # serve dist/ locally
npm run lint      # eslint . — NOTE: no eslint.config.js is committed, so ESLint 9 fails until one is added
```

There is no test suite. Verify changes by running the dev server and exercising each route in Chrome: the demo returns output, and leaving the route terminates its worker.

## Architecture

**App shell** — `src/main.jsx` mounts `React.StrictMode` → `BrowserRouter` → `ViewportHeightFix` + `App`. StrictMode runs each mount effect twice in dev, so a demo visit creates and terminates one extra worker there. `src/App.jsx` lazy-loads each demo (`React.lazy`) onto its route inside `Layout` (`src/Layout.jsx`). `src/HomePage.jsx` holds a separate hard-coded `demoList` (id, name, description, category); add a `categoryNames` entry for any new category. It has no WebGPU detection; a WebGPU-only demo needs its own capability check.

**Demos** — each `src/demos/<id>/` has:
- `App.jsx` — the UI. One mount-only effect (`[]` deps) creates the worker with `new Worker(new URL("./worker.js", import.meta.url), { type: "module" })`, attaches the message listener, and in its cleanup removes the listener and **terminates the worker**, which releases the model. Keep that cleanup when editing; without it every visit leaks a worker and its model. Keep the listener free of render-time state (read current state inside functional `setState` updaters) so the effect never re-runs.
- `worker.js` — model loading and inference. A static singleton class (`??=` on `pipeline(...)` / `from_pretrained(...)`) loads the model once per worker; a `.catch` resets the cached promise so a failed load can be retried. Each worker imports `src/utils/workerRuntime.js`, which forwards only the `initiate` / `done` / `ready` progress events (`forwardProgress`) and posts `{ status: "error", error }` (`postError`) from the message handler's `try/catch`. Results: zero-shot posts one `{ status: "output", output }` per line and then a bare `{ status: "complete" }`; cross-encoder posts a single `{ status: "complete", output }`. `ready` comes only from `pipeline()`, so cross-encoder tracks loading via `initiate` / `done` on its `.onnx` file. On `error` the UI shows the message and returns to idle; `postError` also logs the full error in the worker console. Progress events only change the UI status while a request is in flight, so a load that keeps reporting after a failed request cannot re-lock the button. A worker-level `error` / `messageerror` (script failed to load, or a throw outside the handler) terminates the worker and puts the UI in a terminal `failed` state that asks for a reload.
- `main.jsx` / `index.css` — leftovers from the upstream standalone versions; not imported by the unified app.

**`/decide` calibration** — `src/demos/decide/data/calibration.json` and `test.json` hold per-label probabilities for the default labels in `labels.js`, scored in Chrome with q4f16 on WebGPU (calibration: CLINC150 train; test: CLINC150 test; label scope notes were written from CLINC150 validation only). `calibration.js` picks the loosest threshold whose one-sided Clopper-Pearson 95% upper bound on acted-on error is within the target (fixed-sequence scan, starting where ≥60 calibration items are acted on). Changing default label text or notes invalidates both JSON files: re-score them (the in-app Recalibrate only covers the calibration set, per device) rather than editing either side alone.

**Adding a demo** touches three places: a new `src/demos/<id>/` folder, a lazy import + `<Route>` in `src/App.jsx`, and an entry in `demoList` in `src/HomePage.jsx`. Keep the README model table in sync.

## Build / runtime constraints

- `vite.config.js`: workers build as ES modules (`worker.format: 'es'`), target `es2022`, `@huggingface/transformers` excluded from dep pre-bundling. The library is only imported from workers, so each worker bundle carries its own copy (~520–550 KB); a `manualChunks` entry for it produces an empty chunk. Don't change these without checking that each demo's worker chunk is still emitted.
- `vercel.json` provides the SPA rewrite to `index.html` and cross-origin isolation headers (COOP `same-origin`, COEP `require-corp`). Isolation enables multi-threaded WASM; without it demos still work, single-threaded. Under `require-corp`, any third-party asset (fonts, images, scripts, iframes) without CORP/CORS headers fails to load — self-host such assets. The Vite dev server does not set these headers.
- ONNX Runtime is self-hosted. transformers.js imports `onnxruntime-web/webgpu` (its bundle makes Vite emit `assets/ort-wasm-simd-threaded.asyncify-*.wasm`, ~27 MB) and would point `env.backends.onnx.wasm.wasmPaths` at jsDelivr. `src/utils/workerRuntime.js` instead sets **both** `wasmPaths.mjs` and `wasmPaths.wasm` to same-origin copies of the standalone runtime (`onnxruntime-web/ort-wasm-simd-threaded.asyncify.{mjs,wasm}?url`, resolved from the onnxruntime-web copy transformers.js depends on, so versions match). Never clear `wasmPaths` or set only `wasm`: ONNX Runtime then uses the factory embedded in its bundle, and under cross-origin isolation its pthread workers are spawned from `import.meta.url` — the whole demo worker bundle — so each thread runs the demo's message handler, reloads the model, and can crash the worker (`Vd is not a function`). With both paths set, transformers.js also caches the runtime in `transformers-cache`. Exception: Safari < 26 without WebGPU, where transformers.js picks the non-asyncify build, still loads from `cdn.jsdelivr.net`. Any CSP or host change must allow `huggingface.co` and `us.aws.cdn.hf.co` (model files) and, for that Safari case, jsDelivr. Multi-threading only happens when the page is cross-origin isolated (Vercel, not `vite`/`vite preview`), so test runtime changes with COOP/COEP headers. After a transformers.js upgrade, recheck that its default `wasmPaths.wasm` still ends in `.asyncify.wasm` (the guard in `workerRuntime.js`), that onnxruntime-web still exports the two `asyncify` files, and that the runtime is requested from the app's own origin.
- Layout height model: `body` is `overflow: hidden`; `.layout-container` is an `auto 1fr auto` grid and `.layout-content` scrolls. Demos fill that row via `.demo-container` / `h-full`. Avoid `transform`, `filter`, `contain`, `will-change` etc. on those wrappers — they would trap `position: fixed` overlays.
- There is no `public/` directory. `index.html` uses an empty `data:` favicon so the browser does not request a missing file.

## Mobile layout

`src/index.css`, `src/Layout.jsx`, and `src/utils/ViewportHeightFix.jsx` together manage viewport height (`--vh`, `--app-height`, `100dvh` fallback) for mobile browsers.
