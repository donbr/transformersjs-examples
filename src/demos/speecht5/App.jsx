import { useState, useEffect, useRef } from "react";

import AudioPlayer from "./components/AudioPlayer";
import Progress from "./components/Progress";
import { SPEAKERS, DEFAULT_SPEAKER } from "./constants";

const App = () => {
  // Model loading
  const [ready, setReady] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [progressItems, setProgressItems] = useState([]);

  // Inputs and outputs
  const [text, setText] = useState("I love Hugging Face!");
  const [selectedSpeaker, setSelectedSpeaker] = useState(DEFAULT_SPEAKER);
  const [output, setOutput] = useState(null);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "initiate":
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, progress: e.data.progress };
              }
              return item;
            }),
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file),
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case "complete":
          // Generation complete: re-enable the "Translate" button
          setDisabled(false);

          const blobUrl = URL.createObjectURL(e.data.output);
          setOutput(blobUrl);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  }, []);

  const handleGenerateSpeech = () => {
    setDisabled(true);
    worker.current.postMessage({
      text,
      speaker_id: selectedSpeaker,
    });
  };

  const isLoading = ready === false;
  return (
    <div className="demo-container bg-gray-100">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-4 bg-black bg-opacity-90 backdrop-blur-sm">
          <label className="text-white text-xl p-3 mb-2">
            Loading models... (only run once)
          </label>
          {progressItems.map((data) => (
            <div key={`${data.name}/${data.file}`} className="w-full max-w-md">
              <Progress
                text={`${data.name}/${data.file}`}
                percentage={data.progress}
              />
            </div>
          ))}
        </div>
      )}
      
      <div className="demo-scroll-area flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg w-full max-w-xl">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-1 text-center">
            In-browser Text to Speech
          </h1>
          <h2 className="text-base font-medium text-gray-700 mb-6 text-center">
            Made with{" "}
            <a
              href="https://huggingface.co/docs/transformers.js"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              🤗 Transformers.js
            </a>
          </h2>
          <div className="mb-4">
            <label
              htmlFor="text"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              Text
            </label>
            <textarea
              id="text"
              className="border border-gray-300 rounded-md p-2 w-full"
              rows="4"
              placeholder="Enter text here"
              value={text}
              onChange={(e) => setText(e.target.value)}
            ></textarea>
          </div>
          <div className="mb-6">
            <label
              htmlFor="speaker"
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              Speaker
            </label>
            <select
              id="speaker"
              className="border border-gray-300 rounded-md p-2 w-full"
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
            >
              {Object.entries(SPEAKERS).map(([key, value]) => (
                <option key={key} value={value}>
                  {key}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-center mb-6">
            <button
              className={`${
                disabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 cursor-pointer hover:bg-blue-600"
              } text-white rounded-md py-2 px-6 text-lg`}
              onClick={handleGenerateSpeech}
              disabled={disabled}
            >
              {disabled ? "Generating..." : "Generate"}
            </button>
          </div>
          {output && <AudioPlayer audioUrl={output} mimeType="audio/wav" />}
        </div>
      </div>
    </div>
  );
};

export default App;
