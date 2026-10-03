// Algorithm check: src/demos/decide/calibration.js must reproduce analyze.py's report.json
// (threshold, coverage, error, near-OOS leak at 5% and 10%) on every spike score file
// in this directory. Run analyze.py first. Checks the algorithm, not the shipped data
// (that is eval-shipped.mjs).
import fs from "node:fs";
import { certifyThreshold, evaluate, clopperPearsonUpper } from "../../src/demos/decide/calibration.js";
const report = JSON.parse(fs.readFileSync("report.json"));
let fails = 0;
for (const f of fs.readdirSync(".").filter((f) => /^scores-.*\.json$/.test(f) && !f.includes(".partial"))) {
  const d = JSON.parse(fs.readFileSync(f));
  const py = report[d.which];
  for (const [key, target] of [["gate_5pct", 0.05], ["gate_10pct", 0.10]]) {
    const thr = certifyThreshold(d.results.calibration, d.keys, target);
    const ev = evaluate(d.results.test, d.keys, thr);
    const exp = py[key];
    const same = thr === exp.threshold && Math.abs(ev.autoRateAll - exp.auto_rate_all) < 1e-9 &&
      (ev.errorAmongActed ?? -1) - (exp.error_among_acted ?? -1) < 1e-9 && Math.abs(ev.leakNear - exp.false_accept_near) < 1e-9;
    if (!same) fails++;
    console.log(`${same ? "ok  " : "FAIL"} ${d.which.padEnd(36)} ${key}: js ${thr} / py ${exp.threshold}  auto ${ev.autoRateAll.toFixed(4)} / ${exp.auto_rate_all.toFixed(4)}`);
  }
}
// Spot-check the bound: 0 errors in 59 -> just under 5%; 0 in 58 -> just over.
console.log("CP(0,59)=", clopperPearsonUpper(0, 59).toFixed(5), "CP(0,58)=", clopperPearsonUpper(0, 58).toFixed(5), "CP(3,124)=", clopperPearsonUpper(3, 124).toFixed(5));
process.exit(fails ? 1 : 0);
