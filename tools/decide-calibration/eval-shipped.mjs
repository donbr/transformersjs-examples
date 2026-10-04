// Data check: certify thresholds on the SHIPPED src/demos/decide/data/calibration.json and
// evaluate them on data/test.json, the same way the /decide page does, at 1/2/3/4/5/10/15% targets.
// Exits non-zero if the results differ from EXPECTED. After re-scoring, update these together:
// EXPECTED here, HEADLINE in src/demos/decide/stats.js (homepage card, checked at the end), the
// results table, charts and lessons in docs/decide.md (the charts are checked below), the Expected table in
// tools/decide-calibration/README.md, the /decide rows in docs/facts.md, and the PR text.
// usage: node tools/decide-calibration/eval-shipped.mjs
import fs from "node:fs";
import { certifyThreshold, decide, evaluate } from "../../src/demos/decide/calibration.js";
import { HEADLINE } from "../../src/demos/decide/stats.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../../src/demos/decide/data/${name}`, import.meta.url)));
const cal = read("calibration.json");
const test = read("test.json");

// target -> [threshold, test in-scope routed, test error when acting, near-OOS leak, far-OOS leak]
const EXPECTED = {
  1: [null, 0, null, 0, 0],
  2: [0.52, 0.624, 0.018, 0.007, 0.007],
  3: [0.51, 0.627, 0.018, 0.007, 0.007],
  4: [0.48, 0.653, 0.017, 0.007, 0.007],
  5: [0.45, 0.68, 0.032, 0.033, 0.007],
  10: [0.38, 0.789, 0.068, 0.073, 0.007],
  15: [0.32, 0.882, 0.106, 0.18, 0.013],
};

const pct = (x) => (x == null ? "  -  " : `${(100 * x).toFixed(1).padStart(5)}%`);
// Expected values must be numbers: a missing or undefined expectation fails instead of passing.
const near = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.0005 + 1e-9;
let fails = 0;
console.log("target  thr   routed(in)  err(acted)  leak near  leak far  acted");
for (const [target, [thr, routed, err, leakNear, leakFar]] of Object.entries(EXPECTED)) {
  const threshold = certifyThreshold(cal.items, cal.keys, Number(target) / 100);
  const ev = evaluate(test.items, test.keys, threshold);
  const ok =
    threshold === thr &&
    near(ev.autoRateInScope, routed) &&
    (err == null ? ev.errorAmongActed == null : near(ev.errorAmongActed, err)) &&
    near(ev.leakNear, leakNear) &&
    near(ev.leakFar, leakFar);
  if (!ok) fails++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${String(target).padStart(2)}%  ${threshold?.toFixed(2) ?? "none"}  ${pct(ev.autoRateInScope)}     ${pct(ev.errorAmongActed)}     ${pct(ev.leakNear)}    ${pct(ev.leakFar)}  ${ev.acted}`,
  );
}
// The homepage's headline (src/demos/decide/stats.js) must match the shipped data.
{
  for (const field of ["target", "threshold", "routedInScope", "errorWhenActing"]) {
    if (typeof HEADLINE[field] !== "number") {
      fails++;
      console.log(`FAIL homepage headline (stats.js): HEADLINE.${field} is ${HEADLINE[field]}, expected a number`);
    }
  }
  const threshold = certifyThreshold(cal.items, cal.keys, HEADLINE.target);
  const ev = evaluate(test.items, test.keys, threshold);
  const ok =
    threshold === HEADLINE.threshold &&
    near(ev.autoRateInScope, HEADLINE.routedInScope) &&
    near(ev.errorAmongActed, HEADLINE.errorWhenActing);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} homepage headline (stats.js): threshold ${HEADLINE.threshold}, ${pct(HEADLINE.routedInScope)} routed, ${pct(HEADLINE.errorWhenActing)} error`);
}
// The charts in docs/decide.md must match the shipped data: the Sankey's counts at the homepage
// target, and every line of the two coverage/error charts (one decimal, as drawn).
{
  // Normalize CRLF so a Windows checkout parses the same as LF.
  const doc = fs.readFileSync(new URL("../../docs/decide.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const blocks = [...doc.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  const check = (name, ok, detail) => {
    if (!ok) fails++;
    console.log(`${ok ? "ok  " : "FAIL"} decide.md ${name}${ok ? "" : `: ${detail}`}`);
  };

  // Sankey: route each test ticket at the homepage target's threshold and count.
  const sankey = blocks.find((b) => b.includes("sankey-beta"));
  const threshold = certifyThreshold(cal.items, cal.keys, HEADLINE.target);
  const want = {};
  const add = (k) => (want[k] = (want[k] ?? 0) + 1);
  const source = { in_scope: "In-scope", near_oos: "Credit card", far_oos: "Off-topic" };
  for (const item of test.items) {
    const d = decide(item.probs, test.keys, threshold);
    add(`${source[item.group]},${d.act ? "Routed" : "Escalated to a person"}`);
    if (d.act) {
      add(`Routed,${item.group !== "in_scope" ? "Out of scope but routed" : d.key === item.gold ? "Right queue" : "Wrong queue"}`);
    }
  }
  const got = {};
  const dupes = [];
  for (const line of (sankey ?? "").split("\n")) {
    const m = line.trim().match(/^(.+),(.+),(\d+)$/);
    if (!m) continue;
    const key = `${m[1]},${m[2]}`;
    if (key in got) dupes.push(`${key} drawn twice`); // a second copy would draw a second link
    got[key] = Number(m[3]);
  }
  const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])];
  const bad = [...dupes, ...keys.filter((k) => want[k] !== got[k]).map((k) => `${k} chart ${got[k]} data ${want[k]}`)];
  check("Sankey counts", Boolean(sankey) && bad.length === 0, sankey ? bad.join("; ") : "no sankey-beta block");

  // Line charts: x-axis targets and each series, rounded to one decimal as drawn.
  const charts = blocks.filter((b) => b.includes("xychart-beta"));
  const series = (b) => [...b.matchAll(/^\s*line \[([^\]]*)\]/gm)].map((m) => m[1].split(",").map(Number));
  const targets = (b) => [...(b.match(/x-axis[^\[]*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
  const at = (t) => evaluate(test.items, test.keys, certifyThreshold(cal.items, cal.keys, t / 100));
  // null (no certified threshold, e.g. at ≤1%) becomes NaN, so no drawn value can match it.
  const r1 = (x) => (x == null ? NaN : Math.round(x * 1000) / 10);
  const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const expectChart = (title, build) => {
    const b = charts.find((c) => c.includes(title));
    if (!b) return check(`chart "${title}"`, false, "missing");
    const ts = targets(b);
    const exp = build(ts.map(at), ts);
    const lines = series(b);
    const diff = exp.map((e, i) => (same(e, lines[i] ?? []) ? null : `line ${i + 1} chart [${lines[i]}] data [${e}]`)).filter(Boolean);
    if (lines.length !== exp.length) diff.push(`${lines.length} lines, expected ${exp.length}`);
    check(`chart "${title}"`, diff.length === 0, diff.join("; "));
  };
  expectChart("In-scope tickets routed", (evs) => [evs.map((e) => r1(e.autoRateInScope))]);
  expectChart("Errors and out-of-scope routing", (evs, ts) => [
    ts,
    evs.map((e) => r1(e.errorAmongActed)),
    evs.map((e) => r1(e.leakNear)),
    evs.map((e) => r1(e.leakFar)),
  ]);
}
process.exit(fails ? 1 : 0);
