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
| Results at 2/3/4/10/15% targets (62.4% / 1.8%, 62.7% / 1.8%, 65.3% / 1.7%, 78.9% / 6.8%, 88.2% / 10.6%, leaks); none at 1% | /decide Policy panel, `docs/decide.md` | Same data | `npm run check:facts` (automated) | 2026-10-04 |
| 357 MB download (q4f16, WebGPU); 487 MB on WASM (q4; also used on WebGPU without `shader-f16`) | Home flagship card, /decide load card | `OpenJev.info().downloadSize` seen in Chrome (WebGPU) and headless Chromium (WASM); consistent with the Hub (q4 weights 477 MB + graph + tokenizer) | Open /decide on each runtime; read the load card | 2026-10-03, measured once |
| ~40 s first load (in our test) | Home flagship card | One cold load on one machine (Windows Chrome, Intel Iris Xe) on the PR #4 preview: 36 s download + 4 s warm-up; connection speed not measured | Clear site data, open /decide, time to Ready | 2026-10-03, measured once |
| ~0.4 s per ticket on WebGPU | Home flagship card | 406–440 ms per decision on the preview; scoring run p50 364 ms (`provenance.json`) | Decide a few tickets on /decide | 2026-10-03, WebGPU only |
| Zero-shot model, banking-ticket test: 72% right intent on in-scope tickets; routing every non-"something else" top label wrong 53%; routed 90% of credit-card and 77% of off-topic tickets | /zero-shot explainer | `tools/decide-calibration/report.json` (`nli-xsmall`: `in_scope_top1` 0.716; `raw_argmax_policy`: acted 690/750 (92%), `error_among_acted` 0.533, near/far 0.90/0.767); spike split, 16 labels incl. "something else", single-label, "The customer wants to {}.", q8 Node CPU — a different task from the page | Read `report.json` | 2026-10-04, checked by research session |
| Fine-tuned small encoders ~100–400× cheaper per request than zero/few-shot frontier LLMs | /decide explainer, `docs/decide.md` | arXiv:2602.06370, arXiv:2608.20371 (2026 preprints, not peer reviewed) | Read the papers' cost tables | 2026-10-03, via research session |
| GLiNER2.5-Decide needs open-jev PR #1; JevK5 is not Jev; Jev publishes no calibration metrics | `docs/decide.md` | GitHub PR, Fastino post, TypeSafe docs (links in `docs/decide.md`) | Re-open the links | 2026-10-03, via research session |
| Cross-encoder reads query + passage together (usually more accurate on reranking benchmarks; one pass per pair, nothing pre-indexed), so it reranks a retriever's top-k; the shown score is sigmoid(logit): not calibrated, not comparable across queries, relevance not truth | /cross-encoder page and explainer | General retrieve-then-rerank practice; worker applies `.sigmoid()` to the logits | — | 2026-10-04, checked by research session |
| Verify (planned) uses an NLI model with the cross-encoder's read-both-together design; the reranker can choose which passages to check — it does not build on the reranker | /cross-encoder intro and explainer, Home cross-encoder and Verify cards (`registry.js`) | Issue #18 decision: the reranker outputs a single relevance score; the zero-shot model's `config.json` has two classes (`entailment` / `not_entailment`), so Verify needs a three-class NLI model | Re-read the reranker and zero-shot model configs on the Hub | 2026-10-04, decided in #18 |
| Guard planned on Llama Prompt Guard 2 (22M) | Home planned card | `meta-llama/Llama-Prompt-Guard-2-22M` on the Hub: gated (manual approval), Llama 4 Community license, no ONNX. A browser build would use a community conversion such as `gravitee-io/Llama-Prompt-Guard-2-22M-onnx` (ungated) | Search the Hub; try the ONNX conversion with transformers.js v4 | 2026-10-04; ONNX path unverified |
| Inference runs in the browser; no inference server | Home hero and metrics, explainers, `index.html` meta description | Architecture (no backend; models fetched from the Hub) | — | by design |
