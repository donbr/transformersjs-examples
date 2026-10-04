// /decide facts shown outside its route (the homepage flagship card). Plain values with no
// data imports, so the homepage chunk stays free of the calibration scores.
//
// HEADLINE is asserted against the shipped data by tools/decide-calibration/eval-shipped.mjs,
// so a re-score that changes it fails that check until this file is updated.
// RUNTIME is measured; its source is docs/facts.md rows 19–21 (download sizes, first load,
// per-ticket time). Update those rows with it when the model, dtype or device selection
// changes.
export const HEADLINE = {
  target: 0.05,
  threshold: 0.45,
  routedInScope: 0.68, // held-out test, share of in-scope tickets auto-routed
  errorWhenActing: 0.032, // held-out test, error among auto-routed tickets
};

export const RUNTIME = {
  downloadWebGPU: '357 MB', // q4f16
  downloadWasm: '487 MB', // q4
  firstLoad: '~40 s', // one cold load on one test machine and connection (download + warm-up)
  perTicket: '~0.4 s', // WebGPU, q4f16
};
