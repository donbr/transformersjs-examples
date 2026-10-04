# The calibration harness behind /decide

How CLINC150 tickets become the shipped threshold, how one ticket is decided in the browser, and where a fine-tuned model would plug in. Built from the code in `tools/decide-calibration/` and `src/demos/decide/` as of 2026-10-04. Method, results and lessons: [`docs/decide.md`](decide.md); commands: [`tools/decide-calibration/README.md`](../tools/decide-calibration/README.md).

**Note on the model's training data.** open-jev was trained on `mteb/banking77` (customer banking messages, 77 intents) plus SST-5 and BoolQ ([model card](https://huggingface.co/com-kotobalabs/open-jev-deberta-v3-large)). That is the same domain as the CLINC150 banking intents used here, so /decide's "zero-shot" labels sit close to what the model was trained on. Read the shipped numbers as in-domain, and expect lower coverage on a queue from another domain.

## Harness map

Every file in tools/decide-calibration and what it produces. Solid arrows are data; hexagons are checks that fail the build when numbers drift.

```mermaid
flowchart TB
  subgraph DATA["1 · Data"]
    CLINC[("CLINC150 plus<br/>clinc/clinc_oos parquet")]
    BS["build_split.py"]
    SPLIT[("decide_split.json<br/>550 calibration · 750 test")]
    SPIKE[("clinc_banking.json<br/>dev = CLINC validation")]
    CLINC --> BS --> SPLIT
    CLINC --> SPIKE
  end
  subgraph LAB["2 · Labels"]
    LABELS["labels.js · question.js<br/>15 banking labels + other<br/>scope notes"]
  end
  subgraph SCORE["3 · Score in a real browser"]
    ESB["esbuild bundle of<br/>score-browser.js"]
    SERVE["serve.py<br/>COOP/COEP + POST /save"]
    SB["score-browser.html<br/>Chrome · WebGPU · q4f16"]
    PART[(".partial.json<br/>every 100 items")]
    SCORES[("scores-decide-q4f16-webgpu.json")]
    ESB --> SB
    SERVE --- SB
    SB --> PART
    SB --> SCORES
  end
  subgraph SHIP["4 · App data"]
    MD["make_data.py"]
    CAL[("calibration.json<br/>text + probs")]
    TEST[("test.json<br/>probs only")]
    PROV[("provenance.json<br/>runtime + timings")]
    MD --> CAL
    MD --> TEST
    MD --> PROV
  end
  subgraph SPK["Model comparison spike"]
    SC["score.mjs · Node CPU<br/>NLI · open-jev · GLiNER2.5 · kev"]
    RAW[("spike score files")]
    AN["analyze.py"]
    REP[("report.json")]
    SC --> RAW --> AN --> REP
  end
  SPIKE -. "confident errors" .-> LABELS
  LABELS --> ESB
  SPLIT --> SB
  SCORES --> MD
  SPIKE --> SC
  CALJS["src/demos/decide/calibration.js"]
  EVAL{{"eval-shipped.mjs<br/>EXPECTED table + stats.js HEADLINE"}}
  PAR{{"parity.mjs<br/>calibration.js matches analyze.py"}}
  APP["Decide page"]
  CAL --> EVAL
  TEST --> EVAL
  CALJS --> EVAL
  RAW --> PAR
  CALJS --> PAR
  AN --> PAR
  CAL --> APP
  TEST --> APP
  CALJS --> APP
  classDef check stroke:#d97706,stroke-width:2px
  class EVAL,PAR check
```

## Three splits, three jobs

The guarantee holds only if no text crosses these lines. Scope notes come from dev, the threshold from calibration, the reported numbers from test.

```mermaid
flowchart LR
  subgraph SRC["CLINC150 plus"]
    V["validation"]
    T["train"]
    X["test"]
  end
  V --> DEV["Dev<br/>300 banking · 150 credit · 100 oos"]
  T -- "seed 20261004<br/>20 per banking intent<br/>10 per credit intent" --> CALS["Calibration<br/>300 banking · 150 credit · 100 oos"]
  X --> TST["Test<br/>450 banking · 150 credit · 150 oos"]
  DEV --> U1["Write scope notes<br/>from confident errors"]
  CALS --> U2["Choose the threshold<br/>Clopper-Pearson 95%"]
  TST --> U3["Report coverage, error,<br/>near and far leak"]
  TST -. "also used to pick the model<br/>so mildly optimistic" .-> U4["Spike comparison"]
  classDef caveat stroke:#d97706,stroke-width:2px,stroke-dasharray:5 4
  class U4 caveat
```

## One ticket at runtime

What happens in the tab. The model call returns probabilities; the act-or-escalate decision is plain arithmetic on them.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant P as Decide page
  participant W as worker.js
  participant J as open-jev
  participant H as Hugging Face Hub
  participant C as calibration.js
  P->>W: load
  W->>W: pickRuntime: shader-f16 gives q4f16 on WebGPU, else q4 on WebGPU or WASM
  W->>J: OpenJev.info gives downloadSize
  J->>H: fetch ONNX weights, 357 MB, cached after first load
  W->>J: warm-up decide, compiles GPU shaders
  W-->>P: ready
  U->>P: paste ticket
  P->>W: decide(text, labels)
  W->>J: one forward pass over ticket + 16 labels
  J-->>W: probability per label
  W-->>P: probs, ms
  P->>C: decide(probs, keys, threshold)
  alt top label is not other and p >= threshold
    C-->>P: act
    P-->>U: Auto-route to that queue
  else
    C-->>P: escalate
    P-->>U: Send to a person
  end
  Note over P,C: Moving the slider reruns certifyThreshold on cached calibration scores. No model call.
  opt Labels edited
    P->>W: Recalibrate
    W->>J: re-score 550 calibration tickets on this device
    P->>C: certifyThreshold on the new scores
  end
```

## certifyThreshold

Fixed-sequence testing from strict to loose. The first failure stops the scan, which is what keeps the 95% guarantee valid across all the thresholds it looked at.

```mermaid
flowchart TB
  A["Error target, e.g. 5%"] --> B["minActed = max(60, smallest n with 1 - 0.05^(1/n) <= target)<br/>60 at 5% · 99 at 3% · 299 at 1%"]
  B --> C["t = 0.99"]
  C --> D["acted = tickets whose top label is not other and p >= t"]
  D --> E{"acted >= minActed?"}
  E -- "no: too few to test" --> F["t = t - 0.01"]
  E -- yes --> G["errors = wrong label or out-of-scope ticket"]
  G --> H{"Clopper-Pearson 95% upper bound<br/>on errors / acted <= target?"}
  H -- yes --> I["chosen = t"] --> F
  H -- no --> S["Stop"]
  F --> K{"t >= 0.01?"}
  K -- yes --> D
  K -- no --> S
  S --> R["Return chosen<br/>null means escalate everything"]
  R --> OUT["Shipped: 0.45 at 5%<br/>68.0% in-scope routed · 3.2% error on test"]
  classDef stop stroke:#d97706,stroke-width:2px
  class S stop
```

## Fine-tuning loop

Proposed, not built yet. Dashed boxes are new work; solid boxes reuse the harness above unchanged. Each step is tagged with how far it has been checked (2026-10-04); details in the table below.

```mermaid
flowchart TB
  F0["Frame: queues, cost of a wrong route, error target"] --> F1["Customer tickets with final resolved queue<br/>time-based dev · calibration · test"]
  F1 --> F2["Baseline: this harness<br/>labels + scope notes + certifyThreshold"]
  F2 --> F3["Fine-tune with typed-decisions train_encoder.py<br/>--model microsoft/deberta-v3-large · CE + Brier · --augment 0.7<br/>about 1 epoch on an H100 via Modal<br/>confirmed: repo + model card"]
  F3 --> F4["Fit temperature on dev<br/>confirmed: repo + model card"]
  F4 --> F5["Export ONNX with the scoring head, quantize q4f16 and q4<br/>check top-label parity with PyTorch<br/>recipe unverified · input contract confirmed"]
  F5 --> F6["score-browser.js with the new model id<br/>re-score calibration and test<br/>existing harness"]
  F6 --> F7["make_data.py, certifyThreshold, eval-shipped.mjs"]
  F7 --> G{"Coverage at target beats baseline<br/>by more than noise?"}
  G -- no --> F1
  G -- yes --> F8["Shadow next to human routers, then canary"]
  F8 --> M["Monitor coverage at the fixed threshold<br/>and leaks per group"]
  M --> Q{"What changed?"}
  Q -- "traffic mix" --> RC["Recalibrate only"] --> F6
  Q -- "two labels confused" --> SN["Edit scope notes"] --> F6
  Q -- "coverage keeps falling or new queue" --> F3
  M -- "people label escalated tickets" --> F1
  classDef new stroke:#2563eb,stroke-width:2px,stroke-dasharray:6 4
  class F0,F1,F3,F4,F5,F8,M,Q,RC,SN new
```

### What has been checked in the fine-tuning loop

| Step | Status | What was checked |
|------|--------|------------------|
| F3 training script and flags | Confirmed (repo) | [`kotoba-lang/typed-decisions`](https://github.com/kotoba-lang/typed-decisions) (Apache-2.0) has `src/typed_decisions/train_encoder.py` with `--model`, `--augment` (a probability, so `--augment 0.7`), `--brier-weight` and `--epochs`. Its default model is ModernBERT-large, so DeBERTa needs `--model microsoft/deberta-v3-large`. `modal_app.py` runs it on an H100 via Modal. |
| F3 recipe and cost | Confirmed (model card), for open-jev's own run | CE + Brier loss; gold-preserving question augmentation at p = 0.7; 1 epoch, seed 2, one H100, 229 s, about $0.25, on 18,000 train states (banking77 + SST-5 + BoolQ). A run on CLINC rows is a different size; its cost is an estimate until measured. |
| F4 temperature | Confirmed (repo + model card) | `train_encoder.py` fits a post-hoc temperature on the validation split (`fit_temperature`); the shipped model's is 1.05. |
| F5 ONNX export | Recipe unverified | `typed-decisions` contains no ONNX export code, and the [ONNX conversion](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX) publishes no conversion script. A fine-tuned export has to be built and checked from scratch (top-label parity against PyTorch). |
| F5 input contract | Confirmed | The ONNX repo's `config.json` (`open_jev` section) and open-jev's JS encoder agree: `[CLS] [STATE] state [Q] question [OPT] option … [SEP]`, inputs `input_ids`, `attention_mask`, `seg`, `pair_q`, `pair_opt`, one logit per (question, option) pair. A fine-tuned model runs in /decide unchanged **if** its export includes the 3-layer scoring head (`head.safetensors`) with those inputs, and its `config.json` sets `open_jev.temperature` to the fitted value: the open-jev library reads the temperature from there (default 1.05). |
| F6–F7 | Existing harness | `score-browser.js` → `make_data.py` → `certifyThreshold` → `eval-shipped.mjs`, unchanged apart from the model id. |
| F0–F2, F8, monitoring | Proposed process | Not claims to verify; how a deployment would run. |

Trade-off to keep in view: a fine-tuned label set is fixed at training time. /decide's in-browser label editing plus recalibration would no longer be enough; changing a queue means retraining and re-exporting.

Sources: `docs/decide.md`, `tools/decide-calibration/README.md`, `calibration.js`, `worker.js`, `score-browser.js`; the open-jev [model card](https://huggingface.co/com-kotobalabs/open-jev-deberta-v3-large) and [ONNX repo](https://huggingface.co/onnx-community/open-jev-deberta-v3-large-ONNX); [`kotoba-lang/typed-decisions`](https://github.com/kotoba-lang/typed-decisions) (checked 2026-10-04).
