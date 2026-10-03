// Score decide_split.json in the browser with the app's own modules (open-jev, labels, question),
// so the shipped scores match what /decide computes. Bundle with esbuild and open
// score-browser.html through serve.py (COOP/COEP + POST /save); see README.md.
// URL params: dtype (q4f16), device (webgpu). Writes scores-decide-<dtype>-<device>.json.
import { OpenJev } from "open-jev";
import { DEFAULT_LABELS } from "../../src/demos/decide/labels.js";
import { buildQuestion, probabilitiesFor } from "../../src/demos/decide/question.js";

const qs = new URLSearchParams(location.search);
const dtype = qs.get("dtype") ?? "q4f16";
const device = qs.get("device") ?? "webgpu";
const tag = `decide-${dtype}-${device}`;
const log = (m) => { document.getElementById("status").textContent = m; window.__bench.status = m; };
window.__bench = { tag, status: "starting", done: false };

async function main() {
  const split = await (await fetch("./decide_split.json")).json();
  const question = buildQuestion(DEFAULT_LABELS);
  const info = await OpenJev.info({ model: "open-jev", dtype, device });
  const t0 = performance.now();
  const jev = await OpenJev.load({ model: "open-jev", dtype, device, onProgress: ({ loaded }) => log(`loading ${Math.round(loaded / 1e6)} MB`) });
  const loadMs = performance.now() - t0;
  const tw = performance.now();
  await jev.decide("what is my checking balance", [question]);
  const firstCallMs = performance.now() - tw;
  const meta = { ...jev.runtime, cachedAtStart: info.isCached, downloadSize: info.downloadSize, loadMs, firstCallMs, userAgent: navigator.userAgent };
  const out = { meta, keys: DEFAULT_LABELS.map((l) => l.key), calibration: [], test: [] };
  const save = (complete) => fetch(`./save?name=scores-${tag}${complete ? "" : ".partial"}.json`, { method: "POST", body: JSON.stringify({ ...out, complete }) });
  for (const name of ["calibration", "test"]) {
    for (const [i, item] of split[name].entries()) {
      const s = performance.now();
      const [answer] = await jev.decide(item.text, [question]);
      out[name].push({ probs: probabilitiesFor(answer, DEFAULT_LABELS), ms: performance.now() - s });
      if (i % 25 === 0) log(`${name} ${i}/${split[name].length}`);
      if (i > 0 && i % 100 === 0) await save(false);
    }
    await save(false);
  }
  const res = await save(true);
  window.__bench = { ...window.__bench, done: true, saved: res.ok, meta };
  log(`done: saved=${res.ok}`);
}
main().catch((e) => { window.__bench.error = String(e?.stack ?? e); log("error: " + e); });
