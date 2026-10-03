// Default labels for /decide. The text and scope descriptions are exactly what the
// shipped calibration scores were computed with; changing them makes those scores stale.
// Descriptions were written from confusions on CLINC150 validation (the dev split),
// never from the calibration or test splits.

export const QUESTION = "Which request is the bank customer making?";

export const DEFAULT_LABELS = [
  {
    "key": "transfer",
    "text": "transfer money",
    "description": ""
  },
  {
    "key": "transactions",
    "text": "review recent transactions",
    "description": "a list of recent individual transactions"
  },
  {
    "key": "balance",
    "text": "check an account balance",
    "description": "money in a checking or savings account, not credit card rewards or points"
  },
  {
    "key": "freeze_account",
    "text": "freeze an account",
    "description": ""
  },
  {
    "key": "pay_bill",
    "text": "pay a bill",
    "description": ""
  },
  {
    "key": "bill_balance",
    "text": "check how much is owed on a bill",
    "description": ""
  },
  {
    "key": "bill_due",
    "text": "check when a bill is due",
    "description": "the due date of a utility or service bill, not a card expiration date"
  },
  {
    "key": "interest_rate",
    "text": "ask about an interest rate",
    "description": "interest earned or charged on a bank account or loan, not a credit card APR"
  },
  {
    "key": "routing",
    "text": "get a routing number",
    "description": ""
  },
  {
    "key": "min_payment",
    "text": "check a minimum payment",
    "description": ""
  },
  {
    "key": "order_checks",
    "text": "order checks",
    "description": ""
  },
  {
    "key": "pin_change",
    "text": "change a PIN",
    "description": "changing the PIN for a bank account or debit card, not a credit limit"
  },
  {
    "key": "report_fraud",
    "text": "report fraud",
    "description": "unauthorized or suspicious activity on a bank account, not a lost, stolen or damaged card"
  },
  {
    "key": "account_blocked",
    "text": "ask why an account is blocked",
    "description": "a bank account that is locked or frozen, not a single declined card payment"
  },
  {
    "key": "spending_history",
    "text": "review spending history",
    "description": "spending summarized by category or period"
  },
  {
    "key": "other",
    "text": "something else",
    "description": "credit cards (APR, limits, rewards, lost, stolen, replacement or declined cards), credit scores, card applications, or anything that is not deposit-account banking"
  }
];
