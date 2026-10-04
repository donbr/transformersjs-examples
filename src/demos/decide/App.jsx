import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LABELS } from "./labels.js";
import { certifyThreshold, decide, ESCAPE_KEY, evaluate } from "./calibration.js";
import calibrationData from "./data/calibration.json";
import testData from "./data/test.json";
import WhyTypedDecisions from "./WhyTypedDecisions.jsx";
import { RUNTIME } from "./stats.js";
import { primaryButton, secondaryButton } from "../../ui/buttons.js";

const SAMPLES = [
  "Please move $200 from checking to savings",
  "I want to report a stolen card",
  "why is my account locked",
  "what's a good recipe for banana bread",
];

const MB = (bytes) => `${Math.round(bytes / 1e6)}`;
const pct = (x, digits = 1) => (x == null ? "–" : `${(x * 100).toFixed(digits)}%`);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const labelsKey = (labels) => JSON.stringify(labels.map((l) => [l.text, l.description]));
const DEFAULT_KEY = labelsKey(DEFAULT_LABELS);

function Card({ accent, label, children, className = "" }) {
  return (
    <section
      aria-label={label}
      className={`bg-white rounded-lg shadow-md p-5 md:p-6 border-t-4 flex flex-col gap-3 ${accent} ${className}`}
    >
      {children}
    </section>
  );
}

const INITIAL_LOAD = { step: "info", loaded: 0, total: null, isCached: false };

function LoadCard({ load }) {
  const warming = load.step === "warming";
  const cached = load.isCached;
  const fraction = load.total ? Math.min(1, load.loaded / load.total) : 0;
  const steps = [
    { name: cached ? "Load" : "Download", state: warming ? "done" : "active" },
    { name: "Warm up", state: warming ? "active" : "todo" },
    { name: "Ready", state: "todo" },
  ];
  const stepClass = {
    done: "bg-green-100 text-green-800",
    active: "bg-blue-100 text-blue-800",
    todo: "bg-gray-100 text-gray-500",
  };
  // Until the worker reports the real size, name both: the download depends on the device.
  const size = load.total
    ? `${MB(load.total)} MB`
    : `${RUNTIME.downloadWebGPU} on WebGPU or ${RUNTIME.downloadWasm} on WASM`;

  return (
    <Card accent="border-blue-500" label="Model loading">
      <ol className="flex flex-wrap gap-2 text-sm font-semibold">
        {steps.map((s, i) => (
          <li key={s.name} className={`px-3 py-1 rounded-full ${stepClass[s.state]}`}>
            {i + 1} · {s.name}
          </li>
        ))}
      </ol>
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-lg font-semibold min-w-0 flex-1">
          {warming
            ? "Warming up"
            : load.total == null
              ? "Checking the model"
              : cached
                ? "Loading from browser cache"
                : "Downloading model"}
        </span>
        {!warming && load.total != null && (
          <span className="font-mono text-sm text-gray-600 whitespace-nowrap">
            {MB(load.loaded)} / {MB(load.total)} MB
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={warming ? "Warming up" : "Model download"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={warming ? undefined : Math.round(fraction * 100)}
        className="h-2.5 rounded-full bg-gray-200 overflow-hidden"
      >
        {warming ? (
          <div className="h-full w-1/3 bg-blue-600 rounded-full animate-pulse" />
        ) : (
          <div className="h-full bg-blue-600 rounded-full transition-[width]" style={{ width: `${fraction * 100}%` }} />
        )}
      </div>
      <p className="text-sm text-gray-600">
        {warming
          ? "Compiling GPU shaders for the first decision (a few seconds, once per visit)."
          : cached
            ? "Downloaded on an earlier visit, so this is quick."
            : `One-time download of ${size}, cached by your browser afterwards. You can type a ticket while this finishes.`}
      </p>
    </Card>
  );
}

function Verdict({ result, labels, threshold, target, stale }) {
  const { probs, ms } = result;
  const keys = labels.map((l) => l.key);
  const d = decide(probs, keys, threshold);
  const top = labels[keys.indexOf(d.key)];
  const ranked = labels
    .map((l, i) => ({ ...l, p: probs[i] }))
    .sort((a, b) => b.p - a.p);
  // Shown on escalation so a reviewer starts from the likeliest queues.
  const closest = ranked.filter((l) => l.key !== ESCAPE_KEY && l.p >= 0.15).slice(0, 3);

  let why;
  if (d.act) {
    why = `${capitalize(top.text)} is ${d.p.toFixed(2)}, at or above the ${threshold.toFixed(2)} threshold.`;
  } else if (stale) {
    why = "The labels changed since calibration, so every ticket goes to a person until you recalibrate.";
  } else if (threshold === null) {
    why = `No threshold meets a ≤${target}% error target for these labels, so every ticket goes to a person.`;
  } else if (d.key === ESCAPE_KEY) {
    why = `The top answer is "something else" (${d.p.toFixed(2)}): this ticket looks outside the queue.`;
  } else {
    why = `Top label ${capitalize(top.text)} is ${d.p.toFixed(2)}, below the ${threshold.toFixed(2)} threshold.`;
  }

  return (
    <Card accent={d.act ? "border-green-500" : "border-amber-500"} label="Decision">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={`text-xs font-bold uppercase tracking-wider ${d.act ? "text-green-800" : "text-amber-800"}`}>
            {d.act ? "Auto-route" : "Escalate"}
          </span>
          <span className="text-2xl font-bold">
            {d.act ? `Route to ${capitalize(top.text)}` : "Send to a person"}
          </span>
          <span className="text-gray-600">{why}</span>
          {!d.act && closest.length > 0 && (
            <span className="text-sm text-gray-600">
              Closest labels: {closest.map((c) => capitalize(c.text)).join(", ")}
            </span>
          )}
        </div>
        <span className="font-mono text-sm text-gray-500 whitespace-nowrap">{Math.round(ms)} ms</span>
      </div>
      <div className="flex flex-col gap-2">
        {ranked.slice(0, 5).map((l, i) => (
          <div key={l.key} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] gap-3 items-center text-sm">
            <span className="text-gray-700 text-right truncate" title={capitalize(l.text)}>
              {capitalize(l.text)}
            </span>
            <div className="relative h-3.5 bg-gray-100 rounded">
              <div
                className={`absolute inset-y-0 left-0 rounded ${
                  i === 0 ? (d.act ? "bg-green-600" : "bg-amber-500") : "bg-gray-400"
                }`}
                style={{ width: `${l.p * 100}%` }}
              />
              {threshold !== null && (
                <div
                  aria-hidden="true"
                  className="absolute -top-1 -bottom-1 w-0.5 bg-gray-800"
                  style={{ left: `${threshold * 100}%` }}
                />
              )}
            </div>
            <span className="font-mono text-gray-600">{l.p.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {threshold !== null && (
        <span className="text-xs text-gray-500">
          The dark line marks the certified threshold ({threshold.toFixed(2)}).
        </span>
      )}
    </Card>
  );
}

function LabelsCard({ labels, editing, draft, setDraft, onEdit, onSave, onCancel, onReset, edited, disabled }) {
  const texts = draft.map((l) => l.text.trim().toLowerCase());
  const invalid =
    texts.some((t) => !t) || new Set(texts).size !== texts.length;

  return (
    <Card accent="border-amber-500" label="Labels">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-lg font-semibold">Labels &amp; scope notes</h2>
        {!editing && (
          <div className="flex gap-2">
            {edited && (
              <button type="button" onClick={onReset} disabled={disabled} className={`${secondaryButton} text-sm px-3 py-1.5`}>
                Reset
              </button>
            )}
            <button type="button" onClick={onEdit} disabled={disabled} className={`${secondaryButton} text-sm px-3 py-1.5`}>
              Edit
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) onSave();
          }}
        >
          <ul className="flex flex-col gap-3 max-h-[28rem] overflow-y-auto pr-1">
            {draft.map((l, i) => (
              <li key={l.key} className="flex flex-col gap-1">
                <label className="sr-only" htmlFor={`label-${l.key}`}>Label {i + 1}</label>
                <input
                  id={`label-${l.key}`}
                  value={l.text}
                  disabled={l.key === ESCAPE_KEY}
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  className="font-semibold border border-gray-300 rounded-md px-2 py-1 disabled:bg-gray-50"
                />
                <label className="sr-only" htmlFor={`note-${l.key}`}>Scope note for label {i + 1}</label>
                <input
                  id={`note-${l.key}`}
                  value={l.description}
                  placeholder="Scope note (optional)"
                  onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700"
                />
              </li>
            ))}
          </ul>
          {invalid && <p className="text-sm text-red-600">Every label needs a unique, non-empty name.</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className={`${secondaryButton} text-sm px-3 py-1.5`}>Cancel</button>
            <button type="submit" disabled={invalid} className={`${primaryButton} text-sm px-3 py-1.5`}>Save labels</button>
          </div>
        </form>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
          {labels.map((l) => (
            <li key={l.key} className="flex flex-col">
              <span className="font-semibold">{capitalize(l.text)}</span>
              {l.description && <span className="text-sm text-gray-500">{l.description}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="text-xs text-gray-500">
        Editing labels or notes invalidates the threshold until you recalibrate.
      </span>
    </Card>
  );
}

function App() {
  const [load, setLoad] = useState(INITIAL_LOAD);
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | load-error | ready | deciding | failed
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(SAMPLES[0]);
  const [result, setResult] = useState(null);
  const [target, setTarget] = useState(5);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_LABELS);
  const [custom, setCustom] = useState(null); // { key, probs } from a recalibration
  const [calibrating, setCalibrating] = useState(null); // { done, total }

  const worker = useRef(null);
  const requestId = useRef(0);
  const runId = useRef(0);
  const currentKey = labelsKey(labels);
  // Labels and ticket text of the in-flight decide request, captured when it is sent: the
  // reply belongs to them even if either changes before it arrives.
  const pendingLabelsKey = useRef(null);
  const pendingText = useRef(null);
  const pendingCalibrationKey = useRef(null);

  useEffect(() => {
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

    const onMessage = (e) => {
      const msg = e.data;
      switch (msg.status) {
        case "info":
          setLoad((l) => ({ ...l, step: "download", isCached: msg.isCached, total: msg.downloadSize }));
          setRuntime({ device: msg.device, dtype: msg.dtype });
          break;
        case "progress":
          setLoad((l) => ({ ...l, loaded: Math.max(l.loaded, msg.loaded), total: msg.total }));
          break;
        case "warming":
          setLoad((l) => ({ ...l, step: "warming", loaded: l.total ?? l.loaded }));
          break;
        case "ready":
          setStatus("ready");
          break;
        case "decision":
          // Ignore answers to superseded requests; tag the result with the labels and ticket text
          // it was scored under, so showResult hides it once either one changes.
          if (msg.id === requestId.current) {
            setResult({ probs: msg.probs, ms: msg.ms, labelsKey: pendingLabelsKey.current, text: pendingText.current });
            setStatus("ready");
          }
          break;
        case "calibrate-progress":
          if (msg.runId === runId.current) setCalibrating({ done: msg.done, total: msg.total });
          break;
        case "calibrated":
          if (msg.runId === runId.current) {
            setCustom({ key: pendingCalibrationKey.current, probs: msg.probs });
            setCalibrating(null);
          }
          break;
        case "error":
          setError(msg.error);
          setCalibrating(null);
          // A failed load can be retried: the worker drops the rejected load promise.
          setStatus((s) => (s === "loading" ? "load-error" : "ready"));
          break;
        default:
          break;
      }
    };

    // The worker itself failed (its script did not load, or it threw outside the
    // message handler's try/catch). Stop it so no late message can change state.
    const onWorkerError = (e) => {
      e.preventDefault();
      worker.current.terminate();
      setError("The model worker stopped unexpectedly. Reload the page to try again.");
      setCalibrating(null);
      setStatus("failed");
    };

    worker.current.addEventListener("message", onMessage);
    worker.current.addEventListener("error", onWorkerError);
    worker.current.addEventListener("messageerror", onWorkerError);
    worker.current.postMessage({ type: "load" });

    // Terminate the worker so its model is released instead of leaking.
    return () => {
      worker.current.removeEventListener("message", onMessage);
      worker.current.removeEventListener("error", onWorkerError);
      worker.current.removeEventListener("messageerror", onWorkerError);
      worker.current.terminate();
      worker.current = null;
    };
  }, []);

  const keys = useMemo(() => labels.map((l) => l.key), [labels]);

  // Scores that match the current labels: a recalibration on this device if
  // there is one, else the shipped scores for the default labels, else none (stale).
  const usingShipped = custom?.key !== currentKey && currentKey === DEFAULT_KEY;
  const calProbs =
    custom?.key === currentKey
      ? custom.probs
      : usingShipped
        ? calibrationData.items.map((item) => item.probs)
        : null;
  const stale = calProbs === null;

  const calibration = useMemo(() => {
    if (!calProbs) return null;
    const items = calibrationData.items.map((item, i) => ({ ...item, probs: calProbs[i] }));
    const threshold = certifyThreshold(items, keys, target / 100);
    return { threshold, stats: evaluate(items, keys, threshold) };
  }, [calProbs, keys, target]);
  const threshold = calibration?.threshold ?? null;

  const testStats = useMemo(
    () => (usingShipped ? evaluate(testData.items, keys, threshold) : null),
    [usingShipped, keys, threshold],
  );

  const runtimeMismatch =
    usingShipped &&
    runtime &&
    (runtime.device !== calibrationData.runtime.device || runtime.dtype !== calibrationData.runtime.dtype);

  const ready = status === "ready" || status === "deciding";
  const canDecide = status === "ready" && ticket.trim().length > 0 && !calibrating;

  const runDecide = useCallback(() => {
    if (!canDecide) return;
    setError(null);
    setStatus("deciding");
    requestId.current += 1;
    pendingLabelsKey.current = currentKey;
    pendingText.current = ticket.trim();
    worker.current.postMessage({ type: "decide", id: requestId.current, text: ticket.trim(), labels });
  }, [canDecide, ticket, labels, currentKey]);

  const retryLoad = () => {
    setError(null);
    // Reset progress too: the reducer keeps the max loaded bytes seen so far.
    setLoad(INITIAL_LOAD);
    setStatus("loading");
    worker.current.postMessage({ type: "load" });
  };

  const recalibrate = () => {
    // One model call at a time: a recalibration started mid-decision would run concurrently.
    if (status !== "ready" || calibrating) return;
    setError(null);
    runId.current += 1;
    pendingCalibrationKey.current = currentKey;
    setCalibrating({ done: 0, total: calibrationData.items.length });
    worker.current.postMessage({
      type: "calibrate",
      runId: runId.current,
      texts: calibrationData.items.map((item) => item.text),
      labels,
    });
  };

  const saveLabels = () => {
    setLabels(draft.map((l) => ({ ...l, text: l.text.trim(), description: l.description.trim() })));
    setEditing(false);
  };

  // A verdict only shows for the labels and ticket text it was computed from.
  const showResult = result && result.labelsKey === currentKey && result.text === ticket.trim();

  return (
    // The demo wrapper in src/App.jsx provides the max-w-6xl column; the page scrolls in
    // Layout's <main className="layout-content"> (src/Layout.jsx).
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex flex-wrap justify-between items-end gap-3">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-1">Decide</h1>
          <p className="text-gray-600">
            Paste a support ticket. It is routed automatically only when the model is confident enough to meet your
            error target. Everything else goes to a person.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-2.5 py-1 border border-gray-200 rounded-md bg-gray-50 text-sm">
          <span className="font-mono text-gray-600">
            open-jev · DeBERTa-v3-large{runtime ? ` · ${runtime.dtype}` : ""}
          </span>
          {runtime && (
            <span className="text-xs font-bold uppercase tracking-wider px-1.5 rounded bg-blue-100 text-blue-800">
              {runtime.device === "webgpu" ? "WebGPU" : "WASM"}
            </span>
          )}
        </span>
      </header>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex flex-col gap-5 w-full lg:flex-[3] min-w-0">
          {status === "loading" && <LoadCard load={load} />}
          {status === "load-error" && (
            <Card accent="border-red-500" label="Model load failed">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <span role="alert" className="font-semibold">The model could not be loaded</span>
                <button
                  type="button"
                  onClick={retryLoad}
                  className={`${primaryButton} text-sm px-4 py-1.5`}
                >
                  Try again
                </button>
              </div>
              <p className="text-sm text-gray-600">
                This is usually a network problem. Files that finished downloading are cached, so a retry only
                fetches the rest.
              </p>
            </Card>
          )}

          <Card accent="border-transparent" label="Ticket">
            <label htmlFor="ticket" className="font-semibold">Support ticket</label>
            <textarea
              id="ticket"
              rows={3}
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runDecide();
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-md resize-y"
            />
            <div className="flex flex-wrap gap-2" aria-label="Sample tickets">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTicket(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-sm text-gray-500">
                {status === "failed"
                  ? "The model is unavailable."
                  : status === "load-error"
                    ? "Decide unlocks once the model loads"
                  : ready
                    ? "Enter to decide · Shift+Enter for a new line"
                    : "Decide unlocks when the model is ready"}
              </span>
              <button
                type="button"
                onClick={runDecide}
                disabled={!canDecide}
                className={`${primaryButton} px-6 py-2.5`}
              >
                {status === "deciding" ? "Deciding…" : status === "failed" ? "Unavailable" : "Decide"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">Something went wrong: {error}</p>}
          </Card>

          {stale && (
            <section role="status" className="flex gap-3 items-start bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-lg">
              <span>
                <strong>Labels changed. The threshold is out of date.</strong> Every ticket escalates until you
                recalibrate, because the previous threshold was certified for different labels.
              </span>
            </section>
          )}

          {showResult && <Verdict result={result} labels={labels} threshold={threshold} target={target} stale={stale} />}
        </div>

        <aside className="flex flex-col gap-5 w-full lg:flex-[2] min-w-0">
          <Card accent="border-purple-500" label="Policy">
            <h2 className="text-lg font-semibold">Policy</h2>
            <label htmlFor="target" className="flex justify-between text-gray-700">
              <span>Error target for auto-routed tickets</span>
              <strong className="text-gray-900">≤ {target}%</strong>
            </label>
            <input
              id="target"
              type="range"
              min={1}
              max={15}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            {stale && <p className="text-sm text-amber-800">No certified threshold for the edited labels.</p>}
            {(stale || runtimeMismatch) && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={recalibrate}
                  disabled={status !== "ready" || !!calibrating}
                  className={`${primaryButton} px-4 py-2.5`}
                >
                  {calibrating ? `Recalibrating… ${calibrating.done} / ${calibrating.total}` : "Recalibrate"}
                </button>
                <span className="text-xs text-gray-500">
                  Re-scores the {calibrationData.items.length} calibration tickets with the current labels on
                  this device: about 3–4 minutes on integrated graphics. Keep this tab open.
                </span>
              </div>
            )}
            {!stale && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-gray-500">Certified threshold</dt>
                <dd className="font-mono">{threshold === null ? "none (escalate all)" : threshold.toFixed(2)}</dd>
                <dt className="text-gray-500">Calibration: in-scope auto-routed</dt>
                <dd className="font-mono">{pct(calibration.stats.autoRateInScope)}</dd>
                {!testStats && (
                  <>
                    <dt className="text-gray-500">Held-out test</dt>
                    <dd className="text-gray-500">not measured for this setup</dd>
                  </>
                )}
                {testStats && (
                  <>
                    <dt className="text-gray-500">Held-out test: in-scope auto-routed</dt>
                    <dd className="font-mono">{pct(testStats.autoRateInScope)}</dd>
                    <dt className="text-gray-500">Held-out test: error when acting</dt>
                    <dd className="font-mono">{pct(testStats.errorAmongActed)}</dd>
                    <dt className="text-gray-500">Held-out test: out-of-scope routed</dt>
                    <dd className="font-mono">
                      {pct(testStats.leakNear)} near · {pct(testStats.leakFar)} far
                    </dd>
                  </>
                )}
              </dl>
            )}
            {runtimeMismatch && (
              <p className="text-xs text-amber-800">
                The shipped scores were calibrated with {calibrationData.runtime.dtype} on{" "}
                {calibrationData.runtime.device === "webgpu" ? "WebGPU" : "WASM"}; this device runs {runtime.dtype}{" "}
                on {runtime.device === "webgpu" ? "WebGPU" : "WASM"}. Recalibrate for a strict guarantee here.
              </p>
            )}
            <span className="text-xs text-gray-500">
              The threshold is the loosest one whose 95% upper bound on error stays within the target on{" "}
              {calibrationData.items.length} calibration tickets. Moving the slider re-runs that search over cached
              scores without calling the model. Data: CLINC150 banking intents (CC BY 3.0), with credit-card and
              off-topic messages as out-of-scope traffic.
            </span>
          </Card>

          <LabelsCard
            labels={labels}
            editing={editing}
            draft={draft}
            setDraft={setDraft}
            edited={currentKey !== DEFAULT_KEY}
            // No label edits while a decision or recalibration is running.
            disabled={!!calibrating || status === "deciding"}
            onEdit={() => {
              setDraft(labels);
              setEditing(true);
            }}
            onSave={saveLabels}
            onCancel={() => setEditing(false)}
            onReset={() => {
              setLabels(DEFAULT_LABELS);
              setCustom(null);
            }}
          />
        </aside>
      </div>

      {/* A sibling of the tool, not a wrapper: toggling it must not remount the worker. */}
      <WhyTypedDecisions target={target} threshold={threshold} testStats={stale ? null : testStats} />
    </div>
  );
}

export default App;
