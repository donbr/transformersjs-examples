import { useState, useRef, useEffect, useCallback } from "react";

const PLACEHOLDER_TEXTS = [
  "'To Kill a Mockingbird' is a novel by Harper Lee published in 1960. It was immediately successful, winning the Pulitzer Prize, and has become a classic of modern American literature.",
  "The novel 'Moby-Dick' was written by Herman Melville and first published in 1851. It is considered a masterpiece of American literature and deals with complex themes of obsession, revenge, and the conflict between good and evil.",
  "Harper Lee, an American novelist widely known for her novel 'To Kill a Mockingbird', was born in 1926 in Monroeville, Alabama. She received the Pulitzer Prize for Fiction in 1961.",
  "Jane Austen was an English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.",
  "The 'Harry Potter' series, which consists of seven fantasy novels written by British author J.K. Rowling, is among the most popular and critically acclaimed books of the modern era.",
  "'The Great Gatsby', a novel written by American author F. Scott Fitzgerald, was published in 1925. The story is set in the Jazz Age and follows the life of millionaire Jay Gatsby and his pursuit of Daisy Buchanan.",
].sort(() => Math.random() - 0.5);

function App() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const [query, setQuery] = useState(`Who wrote 'To Kill a Mockingbird'?`);
  const [documents, setDocuments] = useState(PLACEHOLDER_TEXTS.join("\n"));

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
      setError(
        "The model worker stopped unexpectedly. Reload the page to try again.",
      );
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

  const run = useCallback(() => {
    setError(null);
    setStatus("processing");
    worker.current.postMessage({
      query,
      documents,
    });
  }, [query, documents]);

  const busy = status !== "idle";

  return (
    <div className="demo-container bg-white">
      <div className="demo-scroll-area p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-4xl font-bold text-center mb-2">
            Reranking w/ The Crispy mixedbread Rerank Models
          </h1>
          <p className="text-lg md:text-xl font-medium text-center mb-6">
            Powered by{" "}
            <a
              href="https://huggingface.co/mixedbread-ai/mxbai-rerank-xsmall-v1"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              mxbai-rerank-xsmall-v1
            </a>{" "}
            and{" "}
            <a
              href="https://huggingface.co/docs/transformers.js"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              🤗 Transformers.js
            </a>
          </p>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Input section */}
            <div className="flex flex-col gap-4 w-full md:w-1/2">
              <div>
                <label className="block text-lg font-medium mb-2">Query</label>
                <textarea
                  placeholder="Enter query."
                  className="border rounded-md w-full p-3 resize-none h-20"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResults([]);
                  }}
                ></textarea>
              </div>
              
              <div className="flex-grow flex flex-col">
                <label className="block text-lg font-medium mb-2">Documents</label>
                <textarea
                  placeholder="Enter documents to compare with the query. One sentence per line."
                  className="border rounded-md w-full p-3 flex-grow resize-none min-h-[300px]"
                  value={documents}
                  onChange={(e) => {
                    setDocuments(e.target.value);
                    setResults([]);
                  }}
                ></textarea>
              </div>

              <div className="flex justify-center mt-4">
                <button
                  className={`py-2 px-6 rounded-lg text-white text-lg font-medium ${
                    busy
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 cursor-pointer"
                  }`}
                  disabled={busy}
                  onClick={run}
                >
                  {!busy
                    ? "Rerank"
                    : status === "loading"
                      ? "Model loading..."
                      : status === "failed"
                        ? "Unavailable"
                        : "Processing"}
                </button>
              </div>
              {error && (
                <p className="text-center text-sm text-red-600">
                  Reranking failed: {error}
                </p>
              )}
            </div>
            
            {/* Results section */}
            <div className="w-full md:w-1/2">
              <div className="sticky top-4">
                <h2 className="text-lg font-medium mb-3 text-center">Results</h2>
                {results.length > 0 ? (
                  <div className="border rounded-md bg-gray-50 p-4">
                    <div className="flex flex-col gap-3">
                      {results.map((result, i) => (
                        <div 
                          key={i} 
                          className="flex gap-3 p-3 bg-white rounded-md shadow-sm border-l-4"
                          style={{
                            borderLeftColor: `rgba(22, 163, 74, ${result.score})`,
                          }}
                        >
                          <span className="font-bold min-w-[60px] text-green-700">
                            {result.score.toFixed(3)}
                          </span>
                          <span>{result.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 border rounded-md p-8 bg-gray-50">
                    {busy ? "Processing..." : "No results yet. Click 'Rerank' to process."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
