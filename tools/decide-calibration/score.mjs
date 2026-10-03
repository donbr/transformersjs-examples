// Model comparison (spike): score every item of clinc_banking.json with one model in Node
// and write scores-<model>[+desc].json (per-item probabilities + latency) for analyze.py.
// usage: node score.mjs <nli-xsmall|nli-modernbert|open-jev|gliner2-decide|kev-0.6b> [dtype|-] [plain|desc]
// gliner2-decide needs open-jev PR #1 (not in the published package): build it as described
// in README.md and run with OPEN_JEV=./open-jev-pr.mjs.
import fs from "node:fs";
import { pipeline, env } from "@huggingface/transformers";

const { OpenJev, choice } = await import(process.env.OPEN_JEV ?? "open-jev");

env.cacheDir = new URL("./.cache/", import.meta.url).pathname;

const which = process.argv[2];
const dtypeArg = process.argv[3] === "-" ? undefined : process.argv[3];
const variant = process.argv[4] ?? "plain"; // "plain" | "desc"
const { banking, data } = JSON.parse(fs.readFileSync(new URL("./clinc_banking.json", import.meta.url)));

// One shared label wording for every model, written before any results were seen.
const PHRASE = {
  transfer: "transfer money",
  transactions: "review recent transactions",
  balance: "check an account balance",
  freeze_account: "freeze an account",
  pay_bill: "pay a bill",
  bill_balance: "check how much is owed on a bill",
  bill_due: "check when a bill is due",
  interest_rate: "ask about an interest rate",
  routing: "get a routing number",
  min_payment: "check a minimum payment",
  order_checks: "order checks",
  pin_change: "change a PIN",
  report_fraud: "report fraud",
  account_blocked: "ask why an account is blocked",
  spending_history: "review spending history",
  other: "something else",
};
const keys = [...banking, "other"];
const options = keys.map((k) => PHRASE[k]);
const QUESTION = "Which request is the bank customer making?";

// Scope descriptions written from confusions on the spike calibration set (CLINC150
// validation), now the dev split; test untouched. Identical to src/demos/decide/labels.js.
// This queue handles deposit-account banking; card products belong to another team.
const DESCRIPTIONS = {
  [PHRASE.interest_rate]: "interest earned or charged on a bank account or loan, not a credit card APR",
  [PHRASE.report_fraud]: "unauthorized or suspicious activity on a bank account, not a lost, stolen or damaged card",
  [PHRASE.pin_change]: "changing the PIN for a bank account or debit card, not a credit limit",
  [PHRASE.balance]: "money in a checking or savings account, not credit card rewards or points",
  [PHRASE.account_blocked]: "a bank account that is locked or frozen, not a single declined card payment",
  [PHRASE.bill_due]: "the due date of a utility or service bill, not a card expiration date",
  [PHRASE.spending_history]: "spending summarized by category or period",
  [PHRASE.transactions]: "a list of recent individual transactions",
  [PHRASE.other]: "credit cards (APR, limits, rewards, lost, stolen, replacement or declined cards), credit scores, card applications, or anything that is not deposit-account banking",
};

let classify;
let meta;
if (which.startsWith("nli-")) {
  const repo = {
    "nli-xsmall": "MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33",
    "nli-modernbert": "MoritzLaurer/ModernBERT-base-zeroshot-v2.0",
  }[which];
  const dtype = dtypeArg ?? "q8";
  const clf = await pipeline("zero-shot-classification", repo, { dtype, device: "cpu" });
  meta = { repo, dtype, family: "nli", passesPerItem: options.length };
  classify = async (text) => {
    const out = await clf(text, options, {
      hypothesis_template: "The customer wants to {}.",
      multi_label: false,
    });
    const byLabel = Object.fromEntries(out.labels.map((l, i) => [l, out.scores[i]]));
    return options.map((o) => byLabel[o]);
  };
} else {
  const dtype = dtypeArg ?? "q4";
  const jev = await OpenJev.load({ model: which, dtype, device: "cpu" });
  meta = { ...jev.runtime, family: jev.runtime.family, passesPerItem: 1, variant };
  classify = async (text) => {
    const q = variant === "desc" ? choice(QUESTION, options, DESCRIPTIONS) : choice(QUESTION, options);
    const [a] = await jev.decide(text, [q]);
    return options.map((o) => a.probabilities[o]);
  };
}

// Warm-up so the first timed item doesn't include session init.
await classify("what is my checking balance");

const results = {};
for (const split of ["calibration", "test"]) {
  results[split] = [];
  for (const item of data[split]) {
    const t0 = performance.now();
    const probs = await classify(item.text);
    const ms = performance.now() - t0;
    results[split].push({ group: item.group, gold: item.gold, probs, ms });
  }
  console.log(`${which} ${split}: ${results[split].length} items`);
}

fs.writeFileSync(
  new URL(`./scores-${which}${variant === "plain" ? "" : "+" + variant}.json`, import.meta.url),
  JSON.stringify({ which: which + (variant === "plain" ? "" : "+" + variant), meta, keys, results }),
);
console.log("done", which, JSON.stringify(meta));
