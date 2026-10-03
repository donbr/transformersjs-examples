"""Turn the browser scoring run into the /decide route's data files.

usage: python3 make_data.py <dir with decide_split.json + scores-decide-q4f16-webgpu.json> <out dir>
Writes <out>/calibration.json and <out>/test.json (probabilities rounded to 5
decimals) and provenance.json next to this script (runtime, browser, timings),
which the rounded data files do not keep.
"""
import json, sys
from pathlib import Path
S = sys.argv[1]; OUT = sys.argv[2]
split = json.load(open(f"{S}/decide_split.json"))
run = json.load(open(f"{S}/scores-decide-q4f16-webgpu.json"))
assert run["complete"] and len(run["calibration"]) == len(split["calibration"]) and len(run["test"]) == len(split["test"])
r5 = lambda ps: [round(p, 5) for p in ps]
runtime = {k: run["meta"][k] for k in ("model", "device", "dtype")}
cal = {
    "source": "CLINC150 (clinc/clinc_oos, plus), train split, seed 20261004: 300 banking in-scope (20 per intent), 150 credit-card (near out-of-scope), 100 out-of-scope. CC BY 3.0.",
    "runtime": runtime,
    "keys": run["keys"],
    "items": [{"text": it["text"], "group": it["group"], "gold": it["gold"], "probs": r5(sc["probs"])} for it, sc in zip(split["calibration"], run["calibration"])],
}
test = {
    "source": "CLINC150 test split, same 750 items as the spike: 450 banking in-scope, 150 credit-card, 150 out-of-scope. Text omitted; only labels and scores ship.",
    "runtime": runtime,
    "keys": run["keys"],
    "items": [{"group": it["group"], "gold": it["gold"], "probs": r5(sc["probs"])} for it, sc in zip(split["test"], run["test"])],
}
json.dump(cal, open(f"{OUT}/calibration.json", "w"), separators=(",", ":"))
json.dump(test, open(f"{OUT}/test.json", "w"), separators=(",", ":"))
ms = sorted(x["ms"] for x in run["test"])
provenance = {
    **{k: run["meta"].get(k) for k in ("model", "family", "device", "dtype", "downloadSize", "userAgent")},
    "loadMs": round(run["meta"]["loadMs"]), "firstCallMs": round(run["meta"]["firstCallMs"]),
    "testLatencyMs": {"p50": round(ms[len(ms) // 2]), "p90": round(ms[int(.9 * len(ms))])},
    "items": {"calibration": len(run["calibration"]), "test": len(run["test"])},
}
json.dump(provenance, open(Path(__file__).parent / "provenance.json", "w"), indent=1)
print("runtime", runtime, "| load %.1fs first call %.0fms | p50 %.0f ms p90 %.0f" % (run["meta"]["loadMs"] / 1000, run["meta"]["firstCallMs"], ms[len(ms) // 2], ms[int(.9 * len(ms))]))
