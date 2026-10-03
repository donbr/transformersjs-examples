import { pipeline } from "@huggingface/transformers";
import { forwardProgress, postError } from "../../utils/workerRuntime.js";

class MyZeroShotClassificationPipeline {
  static task = "zero-shot-classification";
  static model = "MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33";
  static instance = null;

  static async getInstance(progress_callback = null) {
    // Drop a failed load so the next request retries instead of reusing the rejection.
    this.instance ??= pipeline(this.task, this.model, {
      progress_callback,
    }).catch((error) => {
      this.instance = null;
      throw error;
    });

    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  try {
    // Retrieve the pipeline. When called for the first time,
    // this will load the pipeline and save it for future use.
    const classifier =
      await MyZeroShotClassificationPipeline.getInstance(forwardProgress);

    const { text, labels } = event.data;

    const split = text.split("\n");
    for (const line of split) {
      const output = await classifier(line, labels, {
        hypothesis_template: "This text is about {}.",
        multi_label: true,
      });
      // Send the output back to the main thread
      self.postMessage({ status: "output", output });
    }
    // Tell the main thread every line has been classified
    self.postMessage({ status: "complete" });
  } catch (error) {
    postError(error);
  }
});
