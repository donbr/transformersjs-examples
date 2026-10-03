// Act-or-escalate threshold selection over cached per-label probabilities.
//
// A decision ACTS when its top label is not the escape label and that label's
// probability is at least the threshold; otherwise it escalates. An action is an
// error when the label is wrong or the ticket was out of scope.
//
// The threshold is the loosest value, scanned strict to loose, whose one-sided
// Clopper-Pearson upper bound on acted-on error stays at or under the target
// (fixed-sequence testing, as in Learn-then-Test). The scan starts where at least
// MIN_ACTED calibration items would be acted on; that start depends only on the
// scores, never on the labels, so the guarantee is kept.

export const ESCAPE_KEY = "other";
export const MIN_ACTED = 60;
const CONFIDENCE = 0.95;

function topLabel(probs, keys) {
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return { key: keys[best], p: probs[best] };
}

function actedError(item, key) {
  return item.group !== "in_scope" || key !== item.gold;
}

function logBinomialPmf(k, n, p) {
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p);
}

// Lanczos approximation of log Gamma, accurate to ~1e-15 for x > 0.
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function binomialCdf(k, n, p) {
  if (p <= 0) return 1;
  if (p >= 1) return k < n ? 0 : 1;
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += Math.exp(logBinomialPmf(i, n, p));
  return Math.min(1, sum);
}

/** One-sided Clopper-Pearson upper bound on an error rate of k in n. */
export function clopperPearsonUpper(k, n, confidence = CONFIDENCE) {
  if (n === 0 || k >= n) return 1;
  let lo = k / n;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (binomialCdf(k, n, mid) > 1 - confidence) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Loosest certified threshold for an acted-on error target, or null when none
 * qualifies (the safe answer is then to escalate everything).
 * @param {{probs:number[], group:string, gold:string}[]} items calibration items
 * @param {string[]} keys label keys, aligned with each item's probs
 * @param {number} target error target, e.g. 0.05
 */
export function certifyThreshold(items, keys, target) {
  const tops = items.map((item) => ({ item, ...topLabel(item.probs, keys) }));
  let chosen = null;
  for (let step = 99; step >= 1; step--) {
    const threshold = step / 100;
    const acted = tops.filter((t) => t.key !== ESCAPE_KEY && t.p >= threshold);
    if (acted.length < MIN_ACTED) continue;
    const errors = acted.filter((t) => actedError(t.item, t.key)).length;
    if (clopperPearsonUpper(errors, acted.length) <= target) chosen = threshold;
    else break;
  }
  return chosen;
}

/** Outcome of one ticket under a threshold (null threshold escalates everything). */
export function decide(probs, keys, threshold) {
  const top = topLabel(probs, keys);
  const act = threshold !== null && top.key !== ESCAPE_KEY && top.p >= threshold;
  return { act, key: top.key, p: top.p };
}

/** Coverage and error of a threshold on a labeled set. */
export function evaluate(items, keys, threshold) {
  const counts = { in_scope: [0, 0], near_oos: [0, 0], far_oos: [0, 0] }; // [n, acted]
  let acted = 0;
  let errors = 0;
  for (const item of items) {
    const d = decide(item.probs, keys, threshold);
    counts[item.group][0] += 1;
    if (d.act) {
      counts[item.group][1] += 1;
      acted += 1;
      if (actedError(item, d.key)) errors += 1;
    }
  }
  const rate = ([n, a]) => (n ? a / n : 0);
  return {
    threshold,
    autoRateAll: items.length ? acted / items.length : 0,
    autoRateInScope: rate(counts.in_scope),
    errorAmongActed: acted ? errors / acted : null,
    acted,
    leakNear: rate(counts.near_oos),
    leakFar: rate(counts.far_oos),
  };
}
