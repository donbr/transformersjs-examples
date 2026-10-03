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

**App shell** — `src/main.jsx` mounts `BrowserRouter` → `App`. `src/App.jsx` lazy-loads each demo (`React.lazy`) onto its route inside `Layout` (`src/Layout.jsx`). `src/HomePage.jsx` holds a separate hard-coded `demoList` (name, description, category, `requiresWebGPU`); its WebGPU warning only renders when some listed demo has `requiresWebGPU: true`.

**Demos** — each `src/demos/<id>/` has:
- `App.jsx` — the UI. It creates the worker with `new Worker(new URL("./worker.js", import.meta.url), { type: "module" })` and **terminates it on unmount** (`worker.current.terminate()` in an effect cleanup), which releases the model. Keep that cleanup when editing; without it every visit leaks a worker and its model.
- `worker.js` — model loading and inference. A static singleton class (`??=` on `pipeline(...)` / `from_pretrained(...)`) loads the model once per worker, forwards transformers.js `progress_callback` events to the main thread, and posts `{ status: "output" | "complete", ... }` results.
- `main.jsx` / `index.css` — leftovers from the upstream standalone versions; not imported by the unified app.

**Adding a demo** touches three places: a new `src/demos/<id>/` folder, a lazy import + `<Route>` in `src/App.jsx`, and an entry in `demoList` in `src/HomePage.jsx`. Keep the README model table in sync.

## Build / runtime constraints

- `vite.config.js`: workers build as ES modules (`worker.format: 'es'`), target `es2022`, `@huggingface/transformers` excluded from dep pre-bundling and split into its own chunk. Don't change these without checking that each demo's worker chunk is still emitted.
- `vercel.json` provides the SPA rewrite to `index.html` and cross-origin isolation headers (COOP `same-origin`, COEP `require-corp`). Isolation enables multi-threaded WASM; without it demos still work, single-threaded. Under `require-corp`, any third-party asset (fonts, images, scripts, iframes) without CORP/CORS headers fails to load — self-host such assets. The Vite dev server does not set these headers.
- At runtime transformers.js loads the ONNX Runtime wasm/mjs from jsDelivr (`cdn.jsdelivr.net/npm/onnxruntime-web@<version>/dist/ort-wasm-simd-threaded.asyncify.{mjs,wasm}` on 4.3.0); the repo does not override `env.backends.onnx.wasm.wasmPaths`. Any CSP or host change must allow that origin plus `huggingface.co` and `us.aws.cdn.hf.co` (model files), or self-host the runtime. Recheck the URL after any transformers.js version change.
- Layout height model: `body` is `overflow: hidden`; `.layout-container` is an `auto 1fr auto` grid and `.layout-content` scrolls. Demos fill that row via `.demo-container` / `h-full`. Avoid `transform`, `filter`, `contain`, `will-change` etc. on those wrappers — they would trap `position: fixed` overlays.
- `index.html` references `/logo.png`, but there is no `public/` directory in the repo.

## Mobile layout

`src/index.css`, `src/Layout.jsx`, and `src/utils/ViewportHeightFix.jsx` together manage viewport height (`--vh`, `--app-height`, `100dvh` fallback) for mobile browsers.
