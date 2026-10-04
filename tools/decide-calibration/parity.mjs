// Algorithm check: src/demos/decide/calibration.js must reproduce analyze.py's report.json
// (threshold, overall and in-scope coverage, error, near- and far-OOS leak at 5% and 10%) on every spike score file
// in this directory. Run analyze.py first. Checks the algorithm, not the shipped data
// (that is eval-shipped.mjs).
import fs from "node:fs";
import { certifyThreshold, evaluate, clopperPearsonUpper } from "../../src/demos/decide/calibration.js";
// Inputs live next to this script, whatever the working directory. scores-decide-* is
// score-browser.js output (no group/gold) and is not part of the comparison.
const HERE = new URL("./", import.meta.url);
const report = JSON.parse(fs.readFileSync(new URL("report.json", HERE)));
const inputs = fs
  .readdirSync(HERE)
  .filter((f) => /^scores-.*\.json$/.test(f) && !f.includes(".partial") && !f.startsWith("scores-decide-"));
let fails = 0;
if (inputs.length === 0) {
  console.log(`FAIL no spike score files (scores-*.json) in ${HERE.pathname}; nothing was compared`);
  fails++;
}
for (const f of inputs) {
  const d = JSON.parse(fs.readFileSync(new URL(f, HERE)));
  const py = report[d.which];
  if (!py) {
    console.log(`FAIL ${f}: no "${d.which}" entry in report.json (run analyze.py first)`);
    fails++;
    continue;
  }
  for (const [key, target] of [["gate_5pct", 0.05], ["gate_10pct", 0.10]]) {
    const thr = certifyThreshold(d.results.calibration, d.keys, target);
    const ev = evaluate(d.results.test, d.keys, thr);
    const exp = py[key];
    // Two-sided: a JS error rate below Python's must fail too (the unsafe direction
    // for an error claim), and null (nothing acted on) must match null exactly.
    const close = (x, y) => (x == null || y == null ? x == null && y == null : Math.abs(x - y) < 1e-9);
    const same =
      thr === exp.threshold &&
      close(ev.autoRateAll, exp.auto_rate_all) &&
      close(ev.autoRateInScope, exp.auto_rate_in_scope) &&
      close(ev.errorAmongActed, exp.error_among_acted) &&
      close(ev.leakNear, exp.false_accept_near) &&
      close(ev.leakFar, exp.false_accept_far);
    if (!same) fails++;
    console.log(`${same ? "ok  " : "FAIL"} ${d.which.padEnd(36)} ${key}: js ${thr} / py ${exp.threshold}  auto ${ev.autoRateAll.toFixed(4)} / ${exp.auto_rate_all.toFixed(4)}`);
  }
}
// Spot-check the bound: 0 errors in 59 -> just under 5%; 0 in 58 -> just over.
console.log("CP(0,59)=", clopperPearsonUpper(0, 59).toFixed(5), "CP(0,58)=", clopperPearsonUpper(0, 58).toFixed(5), "CP(3,124)=", clopperPearsonUpper(3, 124).toFixed(5));
process.exit(fails ? 1 : 0);
