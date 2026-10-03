// "Why typed decisions?" explainer below the /decide tool. Closed by default; numbers marked
// "measured here" come from the same values as the Policy panel, so they follow the slider and
// disappear when the labels no longer match the shipped scores. Sources: docs/decide.md.

const pct = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);

function Pill({ kind }) {
  const measured = kind === "measured";
  return (
    <span
      className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded align-middle ${
        measured ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      }`}
    >
      {measured ? "Measured here" : "Cited"}
    </span>
  );
}

function Stat({ tone = "gray", children }) {
  const colors = tone === "amber" ? "bg-amber-100 text-amber-900" : "bg-gray-100";
  return <span className={`font-mono text-sm px-1.5 rounded whitespace-nowrap ${colors}`}>{children}</span>;
}

function Section({ title, pill, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold text-gray-800 flex flex-wrap items-center gap-2">
        {title}
        {pill && <Pill kind={pill} />}
      </h3>
      <div className="text-gray-700 leading-relaxed max-w-prose flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Link({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
      {children}
    </a>
  );
}

/**
 * @param {{ target: number, threshold: number|null, testStats: object|null }} props
 * testStats is null when the held-out test was not measured for the current labels.
 */
export default function WhyTypedDecisions({ target, threshold, testStats }) {
  const measured = testStats !== null;
  const notMeasured = <Stat>not measured for these labels</Stat>;

  return (
    <details className="group mt-8 border-t border-gray-200 pt-6">
      <summary className="min-h-[44px] cursor-pointer list-none rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-xl font-semibold text-gray-800">
          Why typed decisions?
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 text-gray-500 transition-transform motion-reduce:transition-none group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <span className="block text-sm text-gray-500">
          How this compares to asking a chat model, and where it falls short
        </span>
      </summary>

      <div className="mt-3 bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500 grid md:grid-cols-2 gap-6">
        <Section title="The problem">
          <p>
            Much enterprise AI work is high-volume routing and classification (support tickets, claims, alerts,
            documents), not open-ended chat. Each item needs one of a fixed set of answers, fast, cheaply, and with a
            known error rate.
          </p>
        </Section>

        <Section title="Small models, at a fraction of the cost" pill="cited">
          <p>
            Two 2026 preprints (not peer reviewed) found that on narrow classification and intent tasks, fine-tuned
            small encoders matched or beat zero- and few-shot frontier LLMs at roughly 100–400× lower cost per request,
            answering in milliseconds rather than about a second. The LLMs were better at spotting out-of-scope
            inputs.
          </p>
          <p className="text-sm">
            <Link href="https://arxiv.org/abs/2602.06370">arXiv:2602.06370</Link> (cost per request) ·{" "}
            <Link href="https://arxiv.org/abs/2608.20371">arXiv:2608.20371</Link> (intent detection, latency)
          </p>
        </Section>

        <Section title="Act only when it is safe" pill="measured">
          <p>
            The model routes a ticket only when an upper bound on its error rate, certified on held-out calibration
            tickets, meets your target. Everything else goes to a person.
          </p>
          <p>
            At the ≤{target}% target:{" "}
            {!measured ? (
              notMeasured
            ) : threshold === null ? (
              <>
                no threshold qualifies, so <Stat>every ticket escalates</Stat>.
              </>
            ) : (
              <>
                <Stat>{pct(testStats.autoRateInScope)} auto-routed</Stat> with{" "}
                <Stat>{pct(testStats.errorAmongActed)} error when acting</Stat> on held-out test tickets.
              </>
            )}
          </p>
        </Section>

        <Section title="Private by construction">
          <p>
            The model runs in this browser tab. It is downloaded once from the Hugging Face Hub and cached; the ticket
            text never leaves your device.
          </p>
        </Section>

        <div className="md:col-span-2 bg-amber-50 border-l-4 border-amber-400 p-4">
          <Section title="Honest limits" pill="measured">
            <p>
              The guarantee bounds error over routed tickets, not for each kind of ticket: at ≤{target}%,{" "}
              {measured ? (
                <Stat tone="amber">{pct(testStats.leakNear)} of credit-card questions</Stat>
              ) : (
                <Stat tone="amber">not measured for these labels</Stat>
              )} still get
              routed to a banking queue. CLINC150 is a clean benchmark, not real tickets. Labels need tuning for each
              queue, and real traffic drifts, so recalibrate on it.
            </p>
          </Section>
        </div>

        <Section title="How an FDE would deploy it">
          <ol className="list-decimal pl-5 flex flex-col gap-1">
            <li>Swap in the customer&apos;s queues as labels, with a catch-all for everything else.</li>
            <li>Write scope notes from the model&apos;s confident errors on a small dev sample.</li>
            <li>Calibrate the threshold on a few hundred labeled tickets.</li>
            <li>Measure on a separate held-out set before going live.</li>
            <li>Monitor routed tickets and recalibrate as traffic drifts.</li>
          </ol>
        </Section>

        <Section title="Relation to Jev">
          <p>
            TypeSafe sells this confidence-routing pattern as a closed API (Jev). This page is an open, inspectable
            version built from open models: a comparison of approach, not a claim of equivalence.
          </p>
          <p className="text-sm">
            <Link href="https://docs.typesafe.ai/patterns/confidence-routing.md">TypeSafe: confidence routing</Link> ·{" "}
            <Link href="https://github.com/nico-martin/open-jev">open-jev</Link> · Data:{" "}
            <Link href="https://huggingface.co/datasets/clinc/clinc_oos">CLINC150</Link> (CC BY 3.0)
          </p>
        </Section>
      </div>
    </details>
  );
}
