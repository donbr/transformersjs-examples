import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { primaryButton } from "../../ui/buttons.js";

// Sample sets: a question and candidate passages, as a retriever might return them.
const SAMPLES = [
  {
    name: "Book facts",
    query: "Who wrote 'To Kill a Mockingbird'?",
    passages: [
      "'To Kill a Mockingbird' is a novel by Harper Lee published in 1960. It was immediately successful, winning the Pulitzer Prize, and has become a classic of modern American literature.",
      "The novel 'Moby-Dick' was written by Herman Melville and first published in 1851. It is considered a masterpiece of American literature and deals with complex themes of obsession, revenge, and the conflict between good and evil.",
      "Harper Lee, an American novelist widely known for her novel 'To Kill a Mockingbird', was born in 1926 in Monroeville, Alabama. She received the Pulitzer Prize for Fiction in 1961.",
      "Jane Austen was an English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.",
      "The 'Harry Potter' series, which consists of seven fantasy novels written by British author J.K. Rowling, is among the most popular and critically acclaimed books of the modern era.",
      "'The Great Gatsby', a novel written by American author F. Scott Fitzgerald, was published in 1925. The story is set in the Jazz Age and follows the life of millionaire Jay Gatsby and his pursuit of Daisy Buchanan.",
    ],
  },
  {
    name: "Help center",
    query: "How do I reset my password if I no longer have access to my email?",
    passages: [
      "To reset your password, click 'Forgot password' on the sign-in page and follow the link we email you.",
      "If you can't reach the email on your account, contact support with your username and a recent invoice number so we can verify your identity and update the address.",
      "You can change your email address from Settings → Account once you are signed in.",
      "Two-factor authentication adds a second step at sign-in using an authenticator app.",
      "Invoices are emailed on the first business day of each month and are also available under Billing.",
      "Sessions expire after 30 days of inactivity, after which you need to sign in again.",
    ],
  },
];

const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
const lines = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);

const card = "bg-white rounded-lg shadow-md border-t-4 border-green-500 p-5 sm:p-6 flex flex-col gap-4 min-w-0";

function App() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const [sample, setSample] = useState(SAMPLES[0].name);
  const [query, setQuery] = useState(SAMPLES[0].query);
  const [documents, setDocuments] = useState(shuffle(SAMPLES[0].passages).join("\n"));

  const [results, setResults] = useState([]);

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
      if (e.data.file?.endsWith(".onnx")) {
        // A load can still report progress after the request already failed (the
        // tokenizer and model download in parallel); don't let it leave idle.
        if (status === "initiate") {
          setStatus((s) => (s === "idle" ? s : "loading"));
        } else if (status === "done") {
          setStatus((s) => (s === "idle" ? s : "ready"));
        }
      } else if (status === "complete") {
        setResults(e.data.output);
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

  const passages = useMemo(() => lines(documents), [documents]);
  const busy = status !== "idle";
  const canRank = !busy && query.trim().length > 0 && passages.length > 0;

  const run = useCallback(() => {
    if (!canRank) return;
    setError(null);
    setStatus("processing");
    worker.current.postMessage({ query: query.trim(), documents: passages.join("\n") });
  }, [canRank, query, passages]);

  const loadSample = (s) => {
    if (busy) return;
    setSample(s.name);
    setQuery(s.query);
    setDocuments(shuffle(s.passages).join("\n"));
    setResults([]);
    setError(null);
  };

  const buttonLabel =
    status === "failed"
      ? "Unavailable"
      : status === "loading"
        ? "Loading model…"
        : busy
          ? "Ranking…"
          : `Rank ${passages.length} passage${passages.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header className="flex flex-col gap-2 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Rank passages by how well they answer a question
        </h1>
        <p className="text-gray-700 sm:text-[17px] leading-relaxed">
          A cross-encoder reads the question and each passage together, then orders the passages by relevance.
          That&apos;s the second stage of search and RAG, after a fast retriever has pulled candidates. It&apos;s also
          the base for the planned Verify tool.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Input */}
        <section aria-label="Input" className={`${card} w-full lg:flex-[5]`}>
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="query" className="font-semibold text-gray-800">
              Question
            </label>
            <input
              id="query"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSample(null);
                setResults([]);
              }}
              className="px-3 py-2.5 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline gap-3">
              <label htmlFor="passages" className="font-semibold text-gray-800">
                Passages, one per line
              </label>
              <span className="font-mono text-sm text-gray-500">
                {passages.length} passage{passages.length === 1 ? "" : "s"}
              </span>
            </div>
            <textarea
              id="passages"
              rows={10}
              value={documents}
              onChange={(e) => {
                setDocuments(e.target.value);
                setSample(null);
                setResults([]);
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md resize-y text-sm"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={run}
              disabled={!canRank}
              className={`${primaryButton} px-6 py-2`}
            >
              {buttonLabel}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">Something went wrong: {error}</p>}
        </section>

        {/* Ranking */}
        <section aria-label="Ranking" className={`${card} w-full lg:flex-[6]`}>
          <h2 className="text-lg font-semibold text-gray-800">Ranking</h2>
          {results.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              {status === "loading"
                ? "Loading the model (one time, cached afterwards)…"
                : busy
                  ? "Ranking…"
                  : "Rank the passages to see which ones answer the question best."}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {results.map((r, i) => {
                const top = i === 0;
                return (
                  <li
                    key={r.corpus_id}
                    className={`grid grid-cols-[28px_1fr] gap-3 p-3 rounded-md border ${
                      top ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center ${
                        top ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                      aria-label={`Rank ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-sm text-gray-800">{r.text}</span>
                      <div className="grid grid-cols-[1fr_3rem] gap-2.5 items-center">
                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full ${top ? "bg-green-600" : "bg-blue-300"}`}
                            style={{ width: `${Math.round(r.score * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-sm text-gray-600 text-right">{r.score.toFixed(2)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {results.length > 0 && (
            <span className="text-sm text-gray-500">
              Scores rank passages for this question only (0–1, not a probability) and measure relevance, not truth:
              a passage can rank first and still be wrong. Checking that is the planned Verify tool&apos;s job.
            </span>
          )}
        </section>
      </div>

      <details className="group border-t border-gray-200 pt-6">
        <summary className="min-h-[44px] cursor-pointer list-none rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-xl font-semibold text-gray-800">
            Where a reranker fits
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-gray-500 transition-transform motion-reduce:transition-none group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="block text-sm text-gray-500">Retrieve wide, rerank narrow, and why it reads pairs</span>
        </summary>
        <div className="mt-3 bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500 grid md:grid-cols-2 gap-6 text-gray-700 leading-relaxed">
          <section className="flex flex-col gap-2 max-w-prose">
            <h3 className="text-lg font-semibold text-gray-800">Retrieve wide, rerank narrow</h3>
            <p>
              Search and RAG systems usually find candidates first with something fast, such as keyword search or
              embeddings compared by similarity, then rerank the top few dozen with a slower, more careful model. This
              page is that second step.
            </p>
          </section>
          <section className="flex flex-col gap-2 max-w-prose">
            <h3 className="text-lg font-semibold text-gray-800">Why it reads pairs</h3>
            <p>
              An embedding model encodes the question and each passage separately, so passages can be embedded once
              and indexed ahead of time. A cross-encoder reads the question and one passage together in a single pass,
              so it can weigh how they relate. That&apos;s usually more accurate on reranking benchmarks, but it needs a
              model run for every question–passage pair and nothing can be precomputed, so it only reranks a
              retriever&apos;s top candidates.
            </p>
          </section>
          <section className="md:col-span-2 flex flex-col gap-2 bg-amber-50 border-l-4 border-amber-400 p-4">
            <h3 className="text-lg font-semibold text-gray-800">Relevance isn&apos;t truth</h3>
            <p>
              The score shown is the model&apos;s raw output squashed to 0–1. It isn&apos;t a calibrated probability,
              it isn&apos;t comparable across different questions, and it measures whether a passage is on topic, not
              whether it&apos;s correct: a confident, wrong passage can rank first. Checking whether a source actually
              supports a claim is the job of the planned Verify tool, which builds on this model.
            </p>
          </section>
        </div>
      </details>
    </div>
  );
}

export default App;
