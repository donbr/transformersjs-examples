import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

// Sample sets: items to sort and the categories to sort them into.
const SAMPLES = [
  {
    name: "Phone reviews",
    categories: ["Battery and charging problems", "Overheating", "Poor build quality", "Software issues"],
    items: [
      "Disappointed with the battery life! The phone barely lasts half a day with regular use. Considering how much I paid for it, I expected better performance in this department.",
      "I bought this phone a week ago, and I'm already frustrated with the battery life. It barely lasts half a day with normal usage. I expected more from a supposedly high-end device",
      "The charging port is so finicky. Sometimes it takes forever to charge, and other times it doesn't even recognize the charger. Frustrating experience!",
      "This phone heats up way too quickly, especially when using demanding apps. It's uncomfortable to hold, and I'm concerned it might damage the internal components over time. Not what I expected",
      "This phone is like holding a hot potato. Video calls turn it into a scalding nightmare. Seriously, can't it keep its cool?",
      "Forget about a heatwave outside; my phone's got its own. It's like a little portable heater. Not what I signed up for.",
      "I dropped the phone from a short distance, and the screen cracked easily. Not as durable as I expected from a flagship device.",
      "Took a slight bump in my bag, and the frame got dinged. Are we back in the flip phone era?",
      "So, my phone's been in my pocket with just keys – no ninja moves or anything. Still, it managed to get some scratches. Disappointed with the build quality.",
      "The software updates are a nightmare. Each update seems to introduce new bugs, and it takes forever for them to be fixed.",
      "Constant crashes and freezes make me want to throw it into a black hole.",
      "Every time I open Instagram, my phone freezes and crashes. It's so frustrating!",
      "I'm not sure what to make of this phone. It's not bad, but it's not great either. I'm on the fence about it.",
      "I hate the color of this phone. It's so ugly!",
      "This phone sucks! I'm returning it.",
    ],
  },
  {
    name: "Support inbox",
    categories: ["Billing and refunds", "Shipping and delivery", "Account access", "Bug report"],
    items: [
      "I was charged twice for my subscription this month. Can you refund the duplicate?",
      "My order says delivered but there's nothing at my door.",
      "I can't log in. The password reset email never arrives.",
      "The export button does nothing when I click it in Firefox.",
      "How do I get an invoice with my company's VAT number on it?",
      "The package arrived with the box crushed and the item broken.",
      "My account got locked after I tried to sign in from a new laptop.",
      "The app crashes every time I open the settings page on Android.",
      "Do you offer a student discount?",
      "Tracking hasn't updated in six days. Where is my parcel?",
    ],
  },
];

const OTHER = "Other";
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
const lines = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);

const card = "bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 sm:p-6 flex flex-col gap-4 min-w-0";
const primaryButton =
  "px-6 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed";
const secondaryButton =
  "px-4 py-2 rounded-md font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50";

function App() {
  const [sample, setSample] = useState(SAMPLES[0].name);
  const [text, setText] = useState(shuffle(SAMPLES[0].items).join("\n"));
  const [categories, setCategories] = useState(SAMPLES[0].categories);
  const [newCategory, setNewCategory] = useState("");
  const [cutoff, setCutoff] = useState(0.5);
  // Raw worker outputs ({ sequence, labels, scores }, scores sorted high to low). Placement
  // is derived at render time, so the cutoff slider and category edits re-sort instantly.
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    // Create a fresh worker per mount; the cleanup below terminates it.
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      const status = e.data.status;
      // A load can still report progress after the request already failed;
      // don't let it leave idle.
      if (status === "initiate") {
        setStatus((s) => (s === "idle" ? s : "loading"));
      } else if (status === "ready") {
        setStatus((s) => (s === "idle" ? s : "processing"));
      } else if (status === "output") {
        const { sequence, labels, scores } = e.data.output;
        setStatus("processing");
        setResults((results) => [...results, { sequence, labels, scores }]);
      } else if (status === "complete") {
        setStatus("idle");
      } else if (status === "error") {
        setError(e.data.error);
        setStatus("idle");
      }
    };

    // The worker itself failed (its script did not load, or it threw outside the
    // message handler's try/catch). Stop it so no late message can change state.
    const onWorkerError = (e) => {
      e.preventDefault();
      worker.current.terminate();
      setError("The model worker stopped unexpectedly. Reload the page to try again.");
      setStatus("failed");
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);
    worker.current.addEventListener("error", onWorkerError);
    worker.current.addEventListener("messageerror", onWorkerError);

    // Define a cleanup function for when the component is unmounted.
    // Terminate the worker so its model is released instead of leaking.
    return () => {
      worker.current.removeEventListener("message", onMessageReceived);
      worker.current.removeEventListener("error", onWorkerError);
      worker.current.removeEventListener("messageerror", onWorkerError);
      worker.current.terminate();
      worker.current = null;
    };
  }, []);

  const items = useMemo(() => lines(text), [text]);
  const busy = status !== "idle";
  const canSort = !busy && items.length > 0 && categories.length > 0;

  const classify = useCallback(() => {
    if (!canSort) return;
    setError(null);
    setResults([]);
    setTotal(items.length);
    setStatus("processing");
    worker.current.postMessage({ text: items.join("\n"), labels: categories });
  }, [canSort, items, categories]);

  const loadSample = (s) => {
    if (busy) return;
    setSample(s.name);
    setText(shuffle(s.items).join("\n"));
    setCategories(s.categories);
    setResults([]);
    setTotal(0);
    setError(null);
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || name === OTHER || categories.includes(name)) return;
    setCategories((c) => [...c, name]);
    setNewCategory("");
  };

  // Group results: the top label wins if it clears the cutoff and is still a category.
  const groups = useMemo(() => {
    const byName = new Map([...categories, OTHER].map((name) => [name, []]));
    for (const r of results) {
      const top = r.labels[0];
      const placed = r.scores[0] >= cutoff && byName.has(top) && top !== OTHER ? top : OTHER;
      byName.get(placed).push({ text: r.sequence, label: top, score: r.scores[0], placed: placed !== OTHER });
    }
    return [...byName].map(([name, list]) => ({ name, items: list })).filter((g) => g.items.length > 0);
  }, [results, categories, cutoff]);

  const done = results.length;
  const buttonLabel =
    status === "failed"
      ? "Unavailable"
      : status === "loading"
        ? "Loading model…"
        : status === "processing"
          ? `Sorting… ${done} / ${total}`
          : `Sort ${items.length} item${items.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col gap-2 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sort text into categories you name</h1>
        <p className="text-gray-700 sm:text-[17px] leading-relaxed">
          Paste a pile of feedback, list the themes you care about, and see where each item lands, with no
          training data and no server. Use it to explore and draft labels. Use{" "}
          <Link to="/decide" className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
            Decide
          </Link>{" "}
          when a result has to be acted on automatically.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Input */}
        <section aria-label="Input" className={`${card} w-full lg:flex-[5]`}>
          <div className="flex justify-between items-baseline gap-3">
            <label htmlFor="items" className="font-semibold text-gray-800">
              Items, one per line
            </label>
            <span className="font-mono text-sm text-gray-500">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Sample sets">
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => loadSample(s)}
                disabled={busy}
                aria-pressed={sample === s.name}
                className={`text-sm px-3 py-1 rounded-full border ${
                  sample === s.name
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <textarea
            id="items"
            rows={8}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSample(null);
            }}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md resize-y text-sm"
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold text-gray-800 mb-2">Categories</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-gray-100 text-sm text-gray-800"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => setCategories((c) => c.filter((x) => x !== name))}
                    disabled={busy || categories.length <= 1}
                    aria-label={`Remove ${name}`}
                    className="w-7 h-7 !min-w-0 !min-h-0 inline-flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-40"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center px-3 py-1 rounded-full border border-dashed border-gray-300 text-sm text-gray-500">
                {OTHER} (below the cutoff)
              </span>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCategory();
              }}
            >
              <label htmlFor="new-category" className="sr-only">
                New category
              </label>
              <input
                id="new-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Add a category"
                disabled={busy}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button type="submit" disabled={busy || !newCategory.trim()} className={secondaryButton}>
                Add
              </button>
            </form>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cutoff" className="flex justify-between text-gray-700">
              <span>Minimum score to place an item</span>
              <strong className="font-mono text-gray-800">{cutoff.toFixed(2)}</strong>
            </label>
            <input
              id="cutoff"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <span className="text-sm text-gray-500">
              Below it, items go to Other. Moving it re-sorts the results instantly. This score isn&apos;t calibrated,
              so it doesn&apos;t predict an error rate.
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button type="button" onClick={classify} disabled={!canSort} className={primaryButton}>
              {buttonLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setResults([]);
                setTotal(0);
              }}
              disabled={busy || results.length === 0}
              className={secondaryButton}
            >
              Clear results
            </button>
          </div>
          {error && <p className="text-sm text-red-600">Something went wrong: {error}</p>}
        </section>

        {/* Results */}
        <section aria-label="Results" className={`${card} w-full lg:flex-[6]`}>
          <div className="flex justify-between items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-800">Results</h2>
            {total > 0 && (
              <span className="font-mono text-sm text-gray-600">
                sorted {done} / {total}
              </span>
            )}
          </div>
          {total > 0 && (
            <div
              role="progressbar"
              aria-label="Items sorted"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="h-1.5 rounded-full bg-gray-200 overflow-hidden"
            >
              <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          )}
          {groups.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              {status === "loading" ? "Loading the model (one time, cached afterwards)…" : "Sort the items to see where each one lands."}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${g.name === OTHER ? "bg-gray-400" : "bg-green-500"}`} aria-hidden="true" />
                  <h3 className="font-semibold text-gray-800">{g.name}</h3>
                  <span className="font-mono text-sm text-gray-500">{g.items.length}</span>
                </div>
                {g.items.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto] gap-3 items-start px-3 py-2 rounded-md bg-gray-50 text-sm"
                  >
                    <span className="text-gray-700">{it.text}</span>
                    <span
                      className={`font-mono text-right ${it.placed ? "text-green-800" : "text-gray-400"}`}
                      title={`Top label: ${it.label}`}
                    >
                      {it.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
          {groups.length > 0 && (
            <span className="text-sm text-gray-500">
              Each score is the model&apos;s confidence in the item&apos;s top category. Grey scores fell below the
              minimum and went to Other; hover a score to see the category it was closest to.
            </span>
          )}
        </section>
      </div>

      <details className="group border-t border-gray-200 pt-6">
        <summary className="min-h-[44px] cursor-pointer list-none rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-xl font-semibold text-gray-800">
            When zero-shot classification fits
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-gray-500 transition-transform motion-reduce:transition-none group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="block text-sm text-gray-500">What it&apos;s good for, and why it isn&apos;t a router</span>
        </summary>
        <div className="mt-3 bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500 grid md:grid-cols-2 gap-6 text-gray-700 leading-relaxed">
          <section className="flex flex-col gap-2 max-w-prose">
            <h3 className="text-lg font-semibold text-gray-800">How it works</h3>
            <p>
              The model is a small natural-language-inference classifier. For every item it checks each category as a
              hypothesis (&ldquo;This text is about Overheating.&rdquo;) and scores how strongly the item supports it.
              Categories are scored independently, so the scores don&apos;t add up to 1, and an item can score high for
              more than one.
            </p>
          </section>
          <section className="flex flex-col gap-2 max-w-prose">
            <h3 className="text-lg font-semibold text-gray-800">Good for</h3>
            <p>
              Exploring a pile of feedback, testing whether a set of categories covers it, and drafting label wording
              before you commit to a taxonomy. It needs no training data, and the text never leaves your browser.
            </p>
          </section>
          <section className="md:col-span-2 flex flex-col gap-2 bg-amber-50 border-l-4 border-amber-400 p-4">
            <h3 className="text-lg font-semibold text-gray-800">Not a router</h3>
            <p>
              The scores aren&apos;t calibrated, so a cutoff doesn&apos;t tell you how often placed items are wrong. In
              the comparison behind Decide (CLINC150 banking tickets, single-label mode and a different prompt from this
              page), this model picked the right label for 72% of in-scope tickets, but acting on its top label for
              every ticket would have been wrong 53% of the time once out-of-scope tickets were counted. Decide adds a
              certified threshold and an escalate path for exactly that reason.
            </p>
          </section>
        </div>
      </details>
    </div>
  );
}

export default App;
