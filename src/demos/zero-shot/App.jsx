import { useState, useRef, useEffect, useCallback } from "react";

const PLACEHOLDER_REVIEWS = [
  // battery/charging problems
  "Disappointed with the battery life! The phone barely lasts half a day with regular use. Considering how much I paid for it, I expected better performance in this department.",
  "I bought this phone a week ago, and I'm already frustrated with the battery life. It barely lasts half a day with normal usage. I expected more from a supposedly high-end device",
  "The charging port is so finicky. Sometimes it takes forever to charge, and other times it doesn't even recognize the charger. Frustrating experience!",

  // overheating
  "This phone heats up way too quickly, especially when using demanding apps. It's uncomfortable to hold, and I'm concerned it might damage the internal components over time. Not what I expected",
  "This phone is like holding a hot potato. Video calls turn it into a scalding nightmare. Seriously, can't it keep its cool?",
  "Forget about a heatwave outside; my phone's got its own. It's like a little portable heater. Not what I signed up for.",

  // poor build quality
  "I dropped the phone from a short distance, and the screen cracked easily. Not as durable as I expected from a flagship device.",
  "Took a slight bump in my bag, and the frame got dinged. Are we back in the flip phone era?",
  "So, my phone's been in my pocket with just keys – no ninja moves or anything. Still, it managed to get some scratches. Disappointed with the build quality.",

  // software
  "The software updates are a nightmare. Each update seems to introduce new bugs, and it takes forever for them to be fixed.",
  "Constant crashes and freezes make me want to throw it into a black hole.",
  "Every time I open Instagram, my phone freezes and crashes. It's so frustrating!",

  // other
  "I'm not sure what to make of this phone. It's not bad, but it's not great either. I'm on the fence about it.",
  "I hate the color of this phone. It's so ugly!",
  "This phone sucks! I'm returning it.",
].sort(() => Math.random() - 0.5);

const PLACEHOLDER_SECTIONS = [
  "Battery and charging problems",
  "Overheating",
  "Poor build quality",
  "Software issues",
  "Other",
];

function App() {
  const [text, setText] = useState(PLACEHOLDER_REVIEWS.join("\n"));

  const [sections, setSections] = useState(
    PLACEHOLDER_SECTIONS.map((title) => ({ title, items: [] })),
  );

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
        setStatus((s) => (s === "idle" ? s : "ready"));
      } else if (status === "output") {
        const { sequence, labels, scores } = e.data.output;

        // Threshold for classification
        const label = scores[0] > 0.5 ? labels[0] : "Other";

        // Look the label up in the latest sections: categories may have been
        // renamed or removed since the request was sent. "Other" is always last.
        setSections((sections) => {
          let sectionID = sections.findIndex((x) => x.title === label);
          if (sectionID === -1) sectionID = sections.length - 1;

          const newSections = [...sections];
          newSections[sectionID] = {
            ...newSections[sectionID],
            items: [...newSections[sectionID].items, sequence],
          };
          return newSections;
        });
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

  const classify = useCallback(() => {
    setError(null);
    setStatus("processing");
    worker.current.postMessage({
      text,
      labels: sections
        .slice(0, sections.length - 1)
        .map((section) => section.title),
    });
  }, [text, sections]);

  const busy = status !== "idle";

  return (
    <div className="demo-container bg-white">
      <div className="demo-scroll-area flex flex-col h-full">
        <div className="p-4">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Zero-Shot Classification
          </h1>
          <p className="text-center mb-4">
            Categorize text without specific training
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row h-full p-4 gap-4">
          {/* Input area */}
          <div className="w-full md:w-1/2 flex flex-col">
            <label className="font-medium mb-2">Input Text</label>
            <textarea
              className="border rounded-md p-3 w-full flex-grow resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to classify"
            ></textarea>
          </div>
          
          {/* Control and output area */}
          <div className="w-full md:w-1/2 flex flex-col">
            <div className="flex flex-col mb-4">
              <div className="flex justify-center gap-2 mb-4">
                <button
                  className={`py-2 px-6 rounded-lg text-white font-medium ${
                    busy
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600 cursor-pointer"
                  }`}
                  disabled={busy}
                  onClick={classify}
                >
                  {!busy
                    ? "Categorize"
                    : status === "loading"
                      ? "Model loading..."
                      : status === "failed"
                        ? "Unavailable"
                        : "Processing"}
                </button>
              </div>

              {error && (
                <p className="text-center text-sm text-red-600 mb-4">
                  Classification failed: {error}
                </p>
              )}

              <div className="flex justify-center gap-2 mb-2">
                <button
                  className="py-1 px-3 rounded text-white text-sm font-medium bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    setSections((sections) => {
                      const newSections = [...sections];
                      newSections.splice(newSections.length - 1, 0, {
                        title: "New Category",
                        items: [],
                      });
                      return newSections;
                    });
                  }}
                >
                  Add category
                </button>
                <button
                  className="py-1 px-3 rounded text-white text-sm font-medium bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  // Keep at least one category besides "Other" so classify() has labels to send.
                  disabled={sections.length <= 2}
                  onClick={() => {
                    setSections((sections) => {
                      const newSections = [...sections];
                      newSections.splice(newSections.length - 2, 1);
                      return newSections;
                    });
                  }}
                >
                  Remove category
                </button>
                <button
                  className="py-1 px-3 rounded text-white text-sm font-medium bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    setSections((sections) =>
                      sections.map((section) => ({
                        ...section,
                        items: [],
                      })),
                    );
                  }}
                >
                  Clear results
                </button>
              </div>
            </div>
            
            {/* Categories */}
            <div className="flex-grow flex flex-col">
              <label className="font-medium mb-2">Categories</label>
              <div className="border rounded-md flex-grow flex overflow-hidden">
                <div className="flex w-full overflow-x-auto h-full">
                  {sections.map((section, index) => (
                    <div key={index} className="flex flex-col min-w-[200px] w-full border-r last:border-r-0">
                      <input
                        disabled={section.title === "Other"}
                        className="w-full border-b px-2 py-1 text-center font-medium bg-gray-50"
                        value={section.title}
                        onChange={(e) => {
                          setSections((sections) => {
                            const newSections = [...sections];
                            newSections[index].title = e.target.value;
                            return newSections;
                          });
                        }}
                      />
                      <div className="overflow-y-auto flex-grow p-1">
                        {section.items.map((item, itemIndex) => (
                          <div
                            className="m-1 border bg-gray-50 rounded p-2 text-sm shadow-sm hover:bg-gray-100"
                            key={itemIndex}
                          >
                            {item}
                          </div>
                        ))}
                        {section.items.length === 0 && (
                          <div className="text-center text-gray-400 p-4 text-sm">
                            No items yet
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
