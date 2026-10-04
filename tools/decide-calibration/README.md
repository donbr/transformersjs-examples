# /decide calibration tooling

Everything needed to rebuild the data behind `/decide`
(`src/demos/decide/data/calibration.json` and `test.json`), check it, and re-run the
model comparison that chose open-jev. Background and lessons: [`docs/decide.md`](../../docs/decide.md).

The shipped scores are valid for one exact setup: the labels and scope notes in
`src/demos/decide/labels.js`, the question in `labels.js`/`question.js`, open-jev
(`onnx-community/open-jev-deberta-v3-large-ONNX`), q4f16, WebGPU. Change any of these and
the data must be re-scored. Editing only one side leaves the page showing a threshold
certified for different labels.

## Files

| File | Role | Committed |
|------|------|-----------|
| `build_split.py` | Downloads CLINC150 parquet and builds the splits (reproduces `decide_split.json` byte for byte) | yes |
| `decide_split.json` | Shipped split: 550 calibration rows (CLINC train) + 750 test rows (CLINC test) | yes |
| `clinc_banking.json` | Spike split: dev rows (CLINC validation) + the same test rows; input to `score.mjs` | no (built) |
| `score-browser.js` / `.html` | Scores `decide_split.json` in Chrome with the app's own labels, question and open-jev | yes |
| `serve.py` | Static server with the app's COOP/COEP headers plus `POST /save` for score files | yes |
| `make_data.py` | Scores → `src/demos/decide/data/*.json` (rounded to 5 decimals) + `provenance.json` | yes |
| `provenance.json` | Runtime, browser and timings of the scoring run behind the shipped data | yes |
| `eval-shipped.mjs` | **Data check**: certifies thresholds on the shipped data at 3/5/10/15% and compares with expected results | yes |
| `score.mjs` | Model comparison in Node (NLI, open-jev, GLiNER2.5-Decide, kev-0.6b) on the spike split | yes |
| `analyze.py` | Model comparison table → `report.json` (gate at 5/10%, conformal, ECE, latency) | yes |
| `report.json` | The spike's comparison results | yes |
| `parity.mjs` | **Algorithm check**: `calibration.js` must reproduce `analyze.py` on every spike score file | yes |

Python scripts need only the standard library, except `build_split.py`, which needs
`pyarrow` (`uv run --with pyarrow python …`). Node scripts use the repo's own
`node_modules` (run `npm ci` at the repo root first).

## Check the shipped data

```bash
node tools/decide-calibration/eval-shipped.mjs
```

Expected for the shipped labels:

| Target | Threshold | Test in-scope routed | Error when acting | Near-OOS leak | Far-OOS leak |
|--------|-----------|----------------------|-------------------|---------------|--------------|
| ≤3% | none (escalate all) | 0% | – | 0% | 0% |
| ≤5% | 0.45 | 68.0% | 3.2% | 3.3% | 0.7% |
| ≤10% | 0.38 | 78.9% | 6.8% | 7.3% | 0.7% |
| ≤15% | 0.32 | 88.2% | 10.6% | 18.0% | 1.3% |

## Regenerate after changing the default labels

1. **Edit `src/demos/decide/labels.js` first.** Write scope notes only from confusions on
   the dev split (`clinc_banking.json` → `data.calibration`, i.e. CLINC validation), never from
   `decide_split.json`.
2. **Build the split** (once; the split does not depend on the labels):
   ```bash
   cd tools/decide-calibration
   uv run --with pyarrow python build_split.py        # downloads parquet into ./parquet
   ```
3. **Bundle the browser scorer.** It bundles `labels.js`, so rebuild after every label change:
   ```bash
   cd ../..   # repo root, so open-jev and transformers.js resolve from the app's node_modules
   npx -y esbuild@0.25.3 tools/decide-calibration/score-browser.js --bundle --format=esm \
     --platform=browser --target=es2022 --outfile=tools/decide-calibration/score-browser.bundle.mjs
   ```
4. **Score in Chrome on WebGPU with `shader-f16`** (the shipped runtime). Playwright in WSL has
   no GPU, so use a real Chrome:
   ```bash
   cd tools/decide-calibration && python3 serve.py 8767
   # open http://127.0.0.1:8767/score-browser.html?dtype=q4f16&device=webgpu
   ```
   It writes `scores-decide-q4f16-webgpu.json` when done (about 1,300 items at ~0.4 s each,
   plus the 357 MB model download), and saves a `.partial.json` every 100 items so a closed
   tab does not lose the run.
5. **Write the app data:**
   ```bash
   python3 make_data.py . ../../src/demos/decide/data
   ```
6. **Check it:** run `node tools/decide-calibration/eval-shipped.mjs`, then update its
   `EXPECTED` table, `HEADLINE` in `src/demos/decide/stats.js` (the homepage card; also checked by
   this script) and the same numbers in `docs/decide.md`, `CLAUDE.md`, `README.md` and the PR
   text.
7. **Check the app:** `npm run build`, then on `/decide` load the model, decide a sample ticket,
   move the error-target slider, and use Edit → Reset.

The in-app **Recalibrate** button re-scores only the calibration set, for the current device,
and does not change the shipped files.

## Re-run the model comparison

`score.mjs` reproduces the rows of `report.json` on the spike split (`clinc_banking.json`):

```bash
cd tools/decide-calibration
node score.mjs nli-xsmall          # MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33, q8
node score.mjs nli-modernbert      # MoritzLaurer/ModernBERT-base-zeroshot-v2.0, q8
node score.mjs open-jev q4         # plain labels
node score.mjs open-jev q4 desc    # labels + scope notes
node score.mjs kev-0.6b q4
python3 analyze.py                 # -> report.json + table
node parity.mjs                    # calibration.js must match analyze.py
```

Models download into `./.cache`. The `browser-open-jev-q4f16-webgpu+desc` row came from an
earlier browser harness on the spike split; `score-browser.js` replaces it for the shipped split.

**GLiNER2.5-Decide** is not supported by the published `open-jev` package (0.1.2). Open
[PR #1](https://github.com/nico-martin/open-jev/pull/1) adds it. To reproduce those rows,
build the PR head (`shreyaskarnik/open-jev`, branch `gliner2-family`, commit `9e0201e`, MIT):

```bash
git clone --depth 1 -b gliner2-family https://github.com/shreyaskarnik/open-jev && cd open-jev
npx -y esbuild@0.25.3 src/index.ts --bundle --format=esm --platform=neutral --target=es2020 \
  --external:@huggingface/transformers --outfile=<repo>/tools/decide-calibration/open-jev-pr.mjs
cd <repo>/tools/decide-calibration
OPEN_JEV=./open-jev-pr.mjs node score.mjs gliner2-decide q4
OPEN_JEV=./open-jev-pr.mjs node score.mjs gliner2-decide q4 desc
```

## Calibrate for a different queue

1. Replace `BANKING`/`CREDIT` in `build_split.py` (or load your own labeled tickets) with three
   disjoint sets: **dev** (write label text and scope notes from its errors), **calibration**
   (a few hundred tickets; the threshold search needs at least 60 acted-on items. Small
   calibration sets cannot certify tight targets: with 550 tickets here, ≤3% had no certifiable
   threshold. Plan the calibration size from the target, e.g. 0 errors in 59 acted-on tickets is
   the minimum for ≤5%), and **test**
   (report numbers only from this).
2. Write the labels in `src/demos/decide/labels.js` (keep a catch-all `other` label with an
   explicit scope note) and follow the regeneration steps above.
3. Real traffic drifts. Re-score a fresh labeled sample periodically and recalibrate.

## Data and licenses

- CLINC150 (`clinc/clinc_oos`, "plus"): Larson et al. 2019, *An Evaluation Dataset for Intent
  Classification and Out-of-Scope Prediction*, EMNLP-IJCNLP. CC BY 3.0. `decide_split.json` and
  `calibration.json` contain CLINC text; `test.json` ships scores only.
- open-jev (MIT, Nico Martin); models from `onnx-community` on the Hugging Face Hub under their
  own licenses.
- Full original spike workspace (raw scores for every model, browser harnesses): kept outside
  the repo in `~/career/decide-spike-snapshot-2026-10-03/`.
