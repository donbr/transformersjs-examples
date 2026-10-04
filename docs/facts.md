# Facts ledger

Every number or factual claim shown on the site, where it comes from, and how to re-check it.
This is a prototype: aim for one quick check per claim, not proof. Numbers can legitimately
change (device, network, browser, a re-score), so record the date and the setup, and update
the row when you re-measure.

**Workflow**
1. Adding or changing a claim on a page? Add or update its row here in the same PR.
2. Run `npm run check:facts` (automated rows). It fails if the shipped /decide data and the
   numbers derived from it disagree.
3. Rows marked `unverified` or `measured once` can be spot-checked by the research session;
   update `Checked` when you do.

| Claim | Where | Source | How to re-check | Checked |
|-------|-------|--------|-----------------|---------|
| 68% of in-scope tickets auto-routed, 3.2% error, threshold 0.45 at ≤5% | Home flagship card, /decide Policy panel | Shipped `src/demos/decide/data/*.json` (`stats.js` `HEADLINE`) | `npm run check:facts` (automated) | 2026-10-04 |
| Results at 3/10/15% targets (78.9% / 6.8%, 88.2% / 10.6%, leaks) | /decide Policy panel, `docs/decide.md` | Same data | `npm run check:facts` (automated) | 2026-10-04 |
| 357 MB download (q4f16, WebGPU); 487 MB on WASM (q4) | Home flagship card, /decide load card | `OpenJev.info().downloadSize` seen in Chrome (WebGPU) and headless Chromium (WASM) | Open /decide on each runtime; read the load card | 2026-10-03, measured once |
| ~40 s first load on a fast connection | Home flagship card | One cold load on the PR #4 preview: 36 s download + 4 s warm-up | Clear site data, open /decide, time to Ready | 2026-10-03, measured once |
| ~0.4 s per ticket on WebGPU | Home flagship card | 406–440 ms per decision on the preview; scoring run p50 364 ms (`provenance.json`) | Decide a few tickets on /decide | 2026-10-03, WebGPU only |
| Zero-shot model: right label for 72% of in-scope tickets; acting on every top label wrong 53% (out-of-scope counted) | /zero-shot explainer | `tools/decide-calibration/report.json` (`nli-xsmall`: `in_scope_top1`, `raw_argmax_policy.error_among_acted`); spike split, single-label mode, different prompt | Read `report.json` | 2026-10-04 |
| Fine-tuned small encoders ~100–400× cheaper per request than zero/few-shot frontier LLMs | /decide explainer, `docs/decide.md` | arXiv:2602.06370, arXiv:2608.20371 (2026 preprints, not peer reviewed) | Read the papers' cost tables | 2026-10-03, via research session |
| GLiNER2.5-Decide needs open-jev PR #1; JevK5 is not Jev; Jev publishes no calibration metrics | `docs/decide.md` | GitHub PR, Fastino post, TypeSafe docs (links in `docs/decide.md`) | Re-open the links | 2026-10-03, via research session |
| Guard planned on Llama Prompt Guard 2 (22M) | Home planned card | `meta-llama/Llama-Prompt-Guard-2-22M` on the Hub | Search the Hub | 2026-10-04 |
| Inference runs in the browser; no inference server | Home hero and metrics, explainers | Architecture (no backend; models fetched from the Hub) | — | by design |
