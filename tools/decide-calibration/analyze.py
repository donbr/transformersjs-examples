"""Evaluate act-or-escalate policies for each scored model.

Decision = argmax over 15 banking intents + "other". The system ACTS when the
argmax is a banking intent and passes the gate; otherwise it ESCALATES.
An action is an error if the intent is wrong, or if the message was out of scope.
"""
import json, math, glob, os, sys, statistics as st

def binom_cdf(k, n, p):
    if p <= 0: return 1.0
    if p >= 1: return 0.0 if k < n else 1.0
    lp, lq = math.log(p), math.log1p(-p)
    return min(1.0, sum(math.exp(math.lgamma(n + 1) - math.lgamma(i + 1) - math.lgamma(n - i + 1) + i * lp + (n - i) * lq) for i in range(k + 1)))

def cp_upper(k, n, conf=0.95):
    """One-sided Clopper-Pearson upper bound on an error rate."""
    if n == 0: return 1.0
    if k >= n: return 1.0
    lo, hi = k / n, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if binom_cdf(k, n, mid) > 1 - conf: lo = mid
        else: hi = mid
    return hi

def decide(item, keys):
    p = item["probs"]
    i = max(range(len(p)), key=p.__getitem__)
    return keys[i], p[i]

def acted_error(item, label):
    return item["group"] != "in_scope" or label != item["gold"]

MIN_ACTED = 60  # floor on acted-on items before a threshold is tested

def min_acted_for(alpha, conf=0.95):
    """Smallest n whose zero-error 95% bound, 1 - (1 - conf)^(1/n), is <= alpha
    (59 at 5%, 99 at 3%), floored at MIN_ACTED. Mirrors minActedFor in calibration.js."""
    if not 0 < alpha < 1:
        return math.inf
    return max(MIN_ACTED, math.ceil(math.log(1 - conf) / math.log(1 - alpha)))

def ltt_threshold(cal, keys, alpha, conf=0.95):
    """Fixed-sequence test from strict to loose; keep the loosest threshold whose
    upper bound on acted-error stays <= alpha (Learn-then-Test style).
    The sequence starts at the first threshold acting on >= min_acted_for(alpha)
    calibration items; that start depends only on the target and the model
    scores, not labels, so the fixed-sequence guarantee is preserved."""
    min_acted = min_acted_for(alpha, conf)
    chosen = None
    for lam in [x / 100 for x in range(99, 0, -1)]:
        acted = [(it, lab) for it in cal for lab, pm in [decide(it, keys)] if lab != "other" and pm >= lam]
        if len(acted) < min_acted:
            continue
        k = sum(acted_error(it, lab) for it, lab in acted)
        if cp_upper(k, len(acted), conf) <= alpha:
            chosen = lam
        else:
            break
    return chosen

def evaluate_gate(test, keys, lam):
    rows = {"in_scope": [0, 0, 0], "near_oos": [0, 0], "far_oos": [0, 0]}  # in: n, acted, acted_correct; oos: n, acted
    errs = acted_n = 0
    for it in test:
        lab, pm = decide(it, keys)
        act = lam is not None and lab != "other" and pm >= lam
        g = it["group"]
        rows[g][0] += 1
        if act:
            rows[g][1] += 1
            acted_n += 1
            if acted_error(it, lab): errs += 1
            elif g == "in_scope": rows[g][2] += 1
    return {
        "threshold": lam,
        "auto_rate_all": acted_n / len(test),
        "auto_rate_in_scope": rows["in_scope"][1] / rows["in_scope"][0],
        "error_among_acted": errs / acted_n if acted_n else None,
        "acted": acted_n,
        "false_accept_near": rows["near_oos"][1] / rows["near_oos"][0],
        "false_accept_far": rows["far_oos"][1] / rows["far_oos"][0],
    }

def conformal(cal, test, keys, alpha):
    scores = sorted(1 - it["probs"][keys.index(it["gold"])] for it in cal)
    n = len(scores)
    qhat = scores[min(n - 1, math.ceil((n + 1) * (1 - alpha)) - 1)]
    cover = single = acted = acted_err = 0
    for it in test:
        s = [k for k, p in zip(keys, it["probs"]) if p >= 1 - qhat]
        cover += it["gold"] in s
        if len(s) == 1:
            single += 1
            if s[0] != "other":
                acted += 1
                acted_err += acted_error(it, s[0])
    return {"alpha": alpha, "coverage": cover / len(test), "singleton_rate": single / len(test),
            "auto_rate_all": acted / len(test), "error_among_acted": acted_err / acted if acted else None}

def ece(items, keys, bins=10):
    b = [[0, 0.0, 0] for _ in range(bins)]
    for it in items:
        lab, pm = decide(it, keys)
        j = min(bins - 1, int(pm * bins))
        b[j][0] += 1; b[j][1] += pm; b[j][2] += lab == it["gold"]
    return sum(abs(c / n - a / n) * n for n, c, a in b if n) / len(items)

# Inputs and output live next to this script, whatever the working directory.
# scores-decide-* is score-browser.js output (a different format, no group/gold) and
# .partial files are incomplete runs; neither belongs in the model comparison.
HERE = os.path.dirname(os.path.abspath(__file__))
REPORT = os.path.join(HERE, "report.json")
inputs = sorted(
    g for g in glob.glob(os.path.join(HERE, "scores-*.json"))
    if ".partial" not in g and not os.path.basename(g).startswith("scores-decide-")
)
if not inputs:
    sys.exit(f"analyze.py: no spike score files (scores-*.json) in {HERE}; nothing to analyze")

# Merge into the existing report so re-scoring one model keeps the other rows.
report = json.load(open(REPORT)) if os.path.exists(REPORT) else {}
for f in inputs:
    d = json.load(open(f))
    keys, cal, test = d["keys"], d["results"]["calibration"], d["results"]["test"]
    ins = [it for it in test if it["group"] == "in_scope"]
    acc_in = sum(decide(it, keys)[0] == it["gold"] for it in ins) / len(ins)
    acc_all = sum(decide(it, keys)[0] == it["gold"] for it in test) / len(test)
    raw = evaluate_gate(test, keys, 0.0)
    ms = [it["ms"] for it in test]
    report[d["which"]] = {
        "meta": d["meta"],
        "in_scope_top1": acc_in,
        "all_top1_incl_other": acc_all,
        "ece": ece(test, keys),
        "raw_argmax_policy": raw,
        "gate_5pct": evaluate_gate(test, keys, ltt_threshold(cal, keys, 0.05)),
        "gate_10pct": evaluate_gate(test, keys, ltt_threshold(cal, keys, 0.10)),
        "conformal_10pct": conformal(cal, test, keys, 0.10),
        "latency_ms_p50": st.median(ms),
        "latency_ms_p90": sorted(ms)[int(0.9 * len(ms))],
    }

json.dump(report, open(REPORT, "w"), indent=1)
pct = lambda x: "  -  " if x is None else f"{100 * x:5.1f}"
print(f"{'model':16} {'in-top1':>7} {'ECE':>5} | raw: {'auto':>5} {'err':>5} {'FAnear':>6} {'FAfar':>5} | gate5: {'thr':>4} {'auto':>5} {'autoIn':>6} {'err':>5} {'FAnear':>6} {'FAfar':>5} | gate10: {'auto':>5} {'err':>5} | p50ms")
for m, r in report.items():
    g, g10, raw = r["gate_5pct"], r["gate_10pct"], r["raw_argmax_policy"]
    thr = "none" if g["threshold"] is None else f"{g['threshold']:.2f}"
    print(f"{m:16} {pct(r['in_scope_top1']):>7} {pct(r['ece']):>5} | raw: {pct(raw['auto_rate_all'])} {pct(raw['error_among_acted'])} {pct(raw['false_accept_near']):>6} {pct(raw['false_accept_far'])} | gate5: {thr:>4} {pct(g['auto_rate_all'])} {pct(g['auto_rate_in_scope']):>6} {pct(g['error_among_acted'])} {pct(g['false_accept_near']):>6} {pct(g['false_accept_far'])} | gate10: {pct(g10['auto_rate_all'])} {pct(g10['error_among_acted'])} | {r['latency_ms_p50']:.0f}")
