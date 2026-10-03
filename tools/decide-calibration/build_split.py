"""Build the /decide calibration and test splits from CLINC150 (clinc/clinc_oos, "plus").

Run:  uv run --with pyarrow python build_split.py [parquet_dir]

Downloads the train/validation/test parquet files into parquet_dir (default
./parquet) if missing, then writes:

  clinc_banking.json  the spike's split: calibration = CLINC validation (all
                      banking rows + sampled credit/oos), test = CLINC test.
                      CLINC validation is now the DEV split: the label scope
                      notes in src/demos/decide/labels.js were written from
                      confusions on it, so never calibrate on it again.
  decide_split.json   the shipped split: calibration = 550 rows sampled from
                      CLINC train (disjoint from dev and test), test = the
                      spike's 750 CLINC test rows, reused verbatim.

The sampling order and seeds reproduce the committed decide_split.json exactly.
CLINC150: Larson et al. 2019, EMNLP-IJCNLP. CC BY 3.0.
"""
import json
import random
import sys
import urllib.request
from pathlib import Path

import pyarrow.parquet as pq

HERE = Path(__file__).parent
URL = "https://huggingface.co/datasets/clinc/clinc_oos/resolve/refs%2Fconvert%2Fparquet/plus/{split}/0000.parquet"

# In scope: the deposit-account banking queue (order = label order in the app).
BANKING = [
    "transfer", "transactions", "balance", "freeze_account", "pay_bill", "bill_balance", "bill_due",
    "interest_rate", "routing", "min_payment", "order_checks", "pin_change", "report_fraud",
    "account_blocked", "spending_history",
]
# Near out-of-scope: credit-card intents, which belong to another team.
CREDIT = [
    "credit_score", "report_lost_card", "credit_limit", "rewards_balance", "new_card", "application_status",
    "card_declined", "international_fees", "apr", "redeem_rewards", "credit_limit_change", "damaged_card",
    "replacement_card_duration", "improve_credit_score", "expiration_date",
]


def load_rows(parquet_dir, split):
    path = parquet_dir / f"{split}.parquet"
    if not path.exists():
        print(f"downloading {split} -> {path}")
        urllib.request.urlretrieve(URL.format(split=split), path)
    names = json.loads(pq.read_schema(path).metadata[b"huggingface"])["info"]["features"]["intent"]["names"]
    table = pq.read_table(path).to_pydict()
    return [{"text": t, "intent": names[i]} for t, i in zip(table["text"], table["intent"])]


def spike_split(parquet_dir):
    """Recipe (a). Validation must be built before test: they share one RNG."""
    rng = random.Random(20261003)

    def build(split, n_credit, n_oos):
        rows = load_rows(parquet_dir, split)
        ins = [{**r, "group": "in_scope", "gold": r["intent"]} for r in rows if r["intent"] in BANKING]
        near = [{**r, "group": "near_oos", "gold": "other"} for r in rows if r["intent"] in CREDIT]
        far = [{**r, "group": "far_oos", "gold": "other"} for r in rows if r["intent"] == "oos"]
        return ins + rng.sample(near, n_credit) + rng.sample(far, n_oos)

    return {"calibration": build("validation", 150, 100), "test": build("test", 150, 150)}


def clean_calibration(parquet_dir):
    """Recipe (b): 20 per banking intent, 10 per credit intent, 100 oos, from train."""
    rng = random.Random(20261004)
    rows = load_rows(parquet_dir, "train")
    cal = []
    for b in BANKING:
        cal += [{"text": r["text"], "group": "in_scope", "gold": b} for r in rng.sample([r for r in rows if r["intent"] == b], 20)]
    for c in CREDIT:
        cal += [{"text": r["text"], "group": "near_oos", "gold": "other"} for r in rng.sample([r for r in rows if r["intent"] == c], 10)]
    cal += [{"text": r["text"], "group": "far_oos", "gold": "other"} for r in rng.sample([r for r in rows if r["intent"] == "oos"], 100)]
    rng.shuffle(cal)
    return cal


def main():
    parquet_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "parquet"
    parquet_dir.mkdir(exist_ok=True)

    spike = spike_split(parquet_dir)
    json.dump({"banking": BANKING, "data": spike}, open(HERE / "clinc_banking.json", "w"), indent=0)

    calibration = clean_calibration(parquet_dir)
    test = [{"text": r["text"], "group": r["group"], "gold": r["gold"]} for r in spike["test"]]
    # The calibration set must not share any text with the dev or test splits.
    seen = {r["text"] for r in spike["calibration"] + spike["test"]}
    overlap = sum(r["text"] in seen for r in calibration)
    assert overlap == 0, f"{overlap} calibration texts also appear in dev/test"

    split = {
        "source": "clinc/clinc_oos (plus) train split, seed 20261004; test = clinc test split as in the spike",
        "banking": BANKING,
        "calibration": calibration,
        "test": test,
    }
    json.dump(split, open(HERE / "decide_split.json", "w"))
    print(f"calibration {len(calibration)} (train), test {len(test)} (test), dev {len(spike['calibration'])} (validation)")


if __name__ == "__main__":
    main()
