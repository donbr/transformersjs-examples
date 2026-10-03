# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single React + Vite SPA that hosts browser-side ML demos adapted from [huggingface/transformers.js-examples](https://github.com/huggingface/transformers.js-examples). All inference runs in the browser via `@huggingface/transformers` v4 (ONNX models fetched from the Hugging Face Hub at runtime); there is no backend.

Live routes: `/zero-shot` (zero-shot classification) and `/cross-encoder` (reranking), both WASM. Planned routes, not yet built: `/decide` (ticket auto-route vs. escalate with a calibrated confidence threshold; open-jev / DeBERTa-v3-large, ~357 MB q4f16, WebGPU-preferred), `/verify` (citation support check, extends cross-encoder), `/guard` (prompt-injection check), optional `/redact` (PII redaction).

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

**App shell** — `src/main.jsx` mounts `BrowserRouter` → `App`. `src/App.jsx` lazy-loads each demo (`React.lazy`) onto its route inside `Layout` (`src/Layout.jsx`). `src/HomePage.jsx` holds a separate hard-coded `demoList` (id, name, description, category); add a `categoryNames` entry for any new category. It has no WebGPU detection; a WebGPU-only demo needs its own capability check.

**Demos** — each `src/demos/<id>/` has:
- `App.jsx` — the UI. One mount-only effect (`[]` deps) creates the worker with `new Worker(new URL("./worker.js", import.meta.url), { type: "module" })`, attaches the message listener, and in its cleanup removes the listener and **terminates the worker**, which releases the model. Keep that cleanup when editing; without it every visit leaks a worker and its model. Keep the listener free of render-time state (read current state inside functional `setState` updaters) so the effect never re-runs.
- `worker.js` — model loading and inference. A static singleton class (`??=` on `pipeline(...)` / `from_pretrained(...)`) loads the model once per worker; a `.catch` resets the cached promise so a failed load can be retried. Each worker imports `src/utils/workerRuntime.js`, which forwards only the `initiate` / `done` / `ready` progress events (`forwardProgress`) and posts `{ status: "error", error }` (`postError`) from the message handler's `try/catch`. Results are `{ status: "output" | "complete", ... }`; the UI shows `error` and returns to idle. Progress events only change the UI status while a request is in flight, so a load that keeps reporting after a failed request cannot re-lock the button. A worker-level `error` / `messageerror` (script failed to load, or a throw outside the handler) terminates the worker and puts the UI in a terminal `failed` state that asks for a reload.
- `main.jsx` / `index.css` — leftovers from the upstream standalone versions; not imported by the unified app.

**Adding a demo** touches three places: a new `src/demos/<id>/` folder, a lazy import + `<Route>` in `src/App.jsx`, and an entry in `demoList` in `src/HomePage.jsx`. Keep the README model table in sync.

## Build / runtime constraints

- `vite.config.js`: workers build as ES modules (`worker.format: 'es'`), target `es2022`, `@huggingface/transformers` excluded from dep pre-bundling. The library is only imported from workers, so each worker bundle carries its own copy (~520 KB); a `manualChunks` entry for it produces an empty chunk. Don't change these without checking that each demo's worker chunk is still emitted.
- `vercel.json` provides the SPA rewrite to `index.html` and cross-origin isolation headers (COOP `same-origin`, COEP `require-corp`). Isolation enables multi-threaded WASM; without it demos still work, single-threaded. Under `require-corp`, any third-party asset (fonts, images, scripts, iframes) without CORP/CORS headers fails to load — self-host such assets. The Vite dev server does not set these headers.
- ONNX Runtime is self-hosted. transformers.js imports `onnxruntime-web/webgpu`, whose bundle embeds the asyncify factory and makes Vite emit `assets/ort-wasm-simd-threaded.asyncify-*.wasm` (~27 MB). transformers.js would otherwise point `env.backends.onnx.wasm.wasmPaths` at jsDelivr; `src/utils/workerRuntime.js` clears it so that bundled same-origin copy is used. Exception: Safari < 26 without WebGPU, where transformers.js picks the non-asyncify build, still loads from `cdn.jsdelivr.net`. Any CSP or host change must allow `huggingface.co` and `us.aws.cdn.hf.co` (model files) and, for that Safari case, jsDelivr. After a transformers.js upgrade, recheck that transformers.js's default `wasmPaths.wasm` still ends in `.asyncify.wasm` (the guard in `workerRuntime.js`; if it doesn't match, the CDN path silently stays in use), that Vite still emits `assets/ort-wasm-simd-threaded.asyncify-<hash>.wasm`, and that the runtime requests it from the app's own origin.
- Layout height model: `body` is `overflow: hidden`; `.layout-container` is an `auto 1fr auto` grid and `.layout-content` scrolls. Demos fill that row via `.demo-container` / `h-full`. Avoid `transform`, `filter`, `contain`, `will-change` etc. on those wrappers — they would trap `position: fixed` overlays.
- There is no `public/` directory. `index.html` uses an empty `data:` favicon so the browser does not request a missing file.

## Mobile layout

`src/index.css`, `src/Layout.jsx`, and `src/utils/ViewportHeightFix.jsx` together manage viewport height (`--vh`, `--app-height`, `100dvh` fallback) for mobile browsers.
