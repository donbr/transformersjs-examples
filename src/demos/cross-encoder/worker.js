import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";
import { forwardProgress, postError } from "../../utils/workerRuntime.js";

class CrossEncoderSingleton {
  static model_id = "mixedbread-ai/mxbai-rerank-xsmall-v1";
  static model = null;
  static tokenizer = null;

  static async getInstance(progress_callback) {
    // Drop a failed load so the next request retries instead of reusing the rejection.
    this.tokenizer ??= AutoTokenizer.from_pretrained(this.model_id).catch(
      (error) => {
        this.tokenizer = null;
        throw error;
      },
    );

    this.model ??= AutoModelForSequenceClassification.from_pretrained(
      this.model_id,
      {
        progress_callback,
      },
    ).catch((error) => {
      this.model = null;
      throw error;
    });

    return Promise.all([this.tokenizer, this.model]);
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  try {
    // Retrieve the tokenizer and model. When called for the first time,
    // this will load them and save them for future use.
    const [tokenizer, model] =
      await CrossEncoderSingleton.getInstance(forwardProgress);

    const { query, documents } = event.data;

    const docs = documents.trim().split("\n");

    const inputs = tokenizer(new Array(docs.length).fill(query), {
      text_pair: docs,
      padding: true,
      truncation: true,
    });
    const { logits } = await model(inputs);
    const output = logits
      .sigmoid()
      .tolist()
      .map(([score], i) => ({
        corpus_id: i,
        score,
        text: docs[i],
      }))
      .sort((a, b) => b.score - a.score);

    // Send the output back to the main thread
    self.postMessage({ status: "complete", output });
  } catch (error) {
    postError(error);
  }
});
