import { choice } from "open-jev";
import { QUESTION } from "./labels.js";

// Build the single open-jev choice question for a label set. Labels without a
// scope note are passed without a description, as during calibration.
export function buildQuestion(labels) {
  const options = labels.map((label) => label.text);
  const described = labels.filter((label) => label.description.trim());
  const descriptions = Object.fromEntries(
    described.map((label) => [label.text, label.description.trim()]),
  );
  return described.length
    ? choice(QUESTION, options, descriptions)
    : choice(QUESTION, options);
}

// Probabilities in label order, as the calibration math expects.
export function probabilitiesFor(answer, labels) {
  return labels.map((label) => answer.probabilities[label.text]);
}
