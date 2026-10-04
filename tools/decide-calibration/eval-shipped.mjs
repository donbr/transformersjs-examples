// Data check: certify thresholds on the SHIPPED src/demos/decide/data/calibration.json and
// evaluate them on data/test.json, the same way the /decide page does, at 3/5/10/15% targets.
// Exits non-zero if the results differ from EXPECTED. After re-scoring, update EXPECTED
// together with the numbers in docs/decide.md, CLAUDE.md, README.md, the homepage's
// DECIDE_STATS (src/HomePage.jsx) and the PR text.
// usage: node tools/decide-calibration/eval-shipped.mjs
import fs from "node:fs";
import { certifyThreshold, evaluate } from "../../src/demos/decide/calibration.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../../src/demos/decide/data/${name}`, import.meta.url)));
const cal = read("calibration.json");
const test = read("test.json");

// target -> [threshold, test in-scope routed, test error when acting, near-OOS leak, far-OOS leak]
const EXPECTED = {
  3: [null, 0, null, 0, 0],
  5: [0.45, 0.68, 0.032, 0.033, 0.007],
  10: [0.38, 0.789, 0.068, 0.073, 0.007],
  15: [0.32, 0.882, 0.106, 0.18, 0.013],
};

const pct = (x) => (x == null ? "  -  " : `${(100 * x).toFixed(1).padStart(5)}%`);
const near = (a, b) => b == null || (a != null && Math.abs(a - b) < 0.0005 + 1e-9);
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
process.exit(fails ? 1 : 0);
