import React from 'react';
import { Link } from 'react-router-dom';
import { liveDemos, plannedDemos } from './demos/registry.js';
import { HEADLINE, RUNTIME } from './demos/decide/stats.js';

// Homepage, aligned with donbr.github.io's HomePage.tsx (hero, metric row, card grid, footer)
// and the design canvas's Home boards. Content spans max-w-6xl px-4 to line up with the header.

const REPO = 'https://github.com/donbr/transformersjs-examples';

const pct = (x, digits) => `${(x * 100).toFixed(digits)}%`;

// The flagship card shows /decide's measured facts (src/demos/decide/stats.js, checked by
// eval-shipped.mjs), so it renders only while /decide is the registry's flagship.
const flagship = liveDemos.find((demo) => demo.flagship && demo.id === 'decide');
const others = liveDemos.filter((demo) => demo !== flagship);

function Pill({ className, children }) {
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function Icon({ paths, className = 'w-4 h-4' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const ICONS = {
  download: ['M12 15V3', 'm7 10 5 5 5-5', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'],
  clock: ['M12 6v6l4 2', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
};

const cardBase = 'bg-white rounded-lg shadow-md border-t-4';

function SectionHeading({ id, title, subtitle }) {
  return (
    <div className="text-center mb-8">
      <h2 id={id} className="text-2xl sm:text-3xl font-bold text-gray-800">
        {title}
      </h2>
      <p className="text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}

function DecideFlagshipCard({ demo }) {
  return (
    <Link
      to={`/${demo.id}`}
      className={`${cardBase} ${demo.accent} p-6 sm:p-7 flex flex-wrap gap-6 lg:gap-10 hover:shadow-lg transition-shadow`}
    >
      <div className="flex-[999_1_26rem] min-w-0 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-bold text-gray-800">{demo.name}</h3>
          <span className="font-mono text-sm text-gray-500">/{demo.id}</span>
          <Pill className="bg-blue-100 text-blue-800">Flagship</Pill>
          <Pill className="bg-green-100 text-green-800">New</Pill>
        </div>
        <p className="text-gray-700 text-[17px] leading-relaxed">{demo.description}</p>
        <span className="font-mono text-sm text-gray-500">{demo.modelName}</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <Icon paths={ICONS.download} />
            {RUNTIME.downloadWebGPU} one-time download ({RUNTIME.downloadWasm} on WASM)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon paths={ICONS.clock} />
            {RUNTIME.firstLoad} first load in our test, then {RUNTIME.perTicket} per ticket on WebGPU
          </span>
          <span className="font-medium text-blue-800">WebGPU preferred · falls back to WASM</span>
        </div>
        <span className="font-medium text-blue-600 mt-1">Open tool →</span>
      </div>
      <div className="flex-[1_1_18rem] min-w-0 flex flex-col gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-5">
        <span className="text-sm font-semibold text-gray-600">Held-out test</span>
        <span className="text-4xl font-bold text-blue-600 leading-tight">{pct(HEADLINE.routedInScope, 0)}</span>
        <span className="text-gray-700">
          {/* U+2011 non-breaking hyphen: keeps "auto-routed" on one line at any panel width. */}
          of in-scope tickets auto{'\u2011'}routed, with {pct(HEADLINE.errorWhenActing, 1)} error when acting
        </span>
        <span className="text-sm text-gray-500">
          CLINC150 banking · ≤{pct(HEADLINE.target, 0)} target · threshold {HEADLINE.threshold.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}

function ToolCard({ demo }) {
  return (
    <Link
      to={`/${demo.id}`}
      className={`${cardBase} ${demo.accent} p-6 flex flex-col gap-2.5 hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-gray-800">{demo.name}</h3>
        {demo.runtime === 'wasm' && <Pill className="bg-gray-100 text-gray-700">WASM</Pill>}
      </div>
      <p className="text-gray-600">{demo.description}</p>
      <span className="font-mono text-sm text-gray-500 break-words">{demo.modelId}</span>
      <span className="font-medium text-blue-600 mt-auto pt-1">Open tool →</span>
    </Link>
  );
}

function PlannedCard({ demo }) {
  return (
    <article className={`${cardBase} ${demo.accent} p-6 flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-gray-800">{demo.name}</h3>
        <Pill className="bg-gray-100 text-gray-700">{demo.optional ? 'Optional' : 'Planned'}</Pill>
      </div>
      <p className="text-gray-600">{demo.description}</p>
      <span className="font-mono text-sm text-gray-500">{demo.detail}</span>
    </article>
  );
}

function HomePage() {
  const metrics = [
    { value: `${liveDemos.length} Live Tools`, caption: liveDemos.map((d) => d.shortName).join(' · '), color: 'text-blue-600' },
    { value: `${plannedDemos.length} Planned`, caption: plannedDemos.map((d) => d.shortName).join(' · '), color: 'text-purple-600' },
    { value: 'WebGPU or WASM', caption: 'Decide uses the GPU when it can', color: 'text-green-600' },
    { value: 'On-device', caption: 'No inference server', color: 'text-orange-600' },
  ];

  return (
    // flex-grow fills App's min-h-full flex wrapper, so a short page still pins the footer.
    <div className="flex-grow flex flex-col">
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3">Transformers.js Examples</h1>
          <p className="text-lg sm:text-xl text-blue-700 font-semibold mb-4">On-device decision &amp; verification tools</p>
          <p className="text-base sm:text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
            Classifiers and rerankers that run entirely in your browser on ONNX Runtime Web. Your text never leaves
            the page. Models download once from the Hugging Face Hub and are cached for later visits.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-4 mb-8">
            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-700 font-medium inline-flex items-center justify-center gap-2"
            >
              Source on GitHub
            </a>
            <a
              href="https://github.com/huggingface/transformers.js-examples"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-500 font-medium inline-flex items-center justify-center gap-2"
            >
              Upstream examples
            </a>
            <a
              href="https://huggingface.co/dwb2023"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex bg-amber-300 text-amber-800 px-6 py-2 rounded-md hover:bg-amber-400 font-medium items-center justify-center gap-2"
            >
              Hugging Face
            </a>
          </div>
          <dl className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-x-3 gap-y-5 sm:gap-x-10 sm:gap-y-6 border-t border-gray-200 pt-6">
            {metrics.map((m) => (
              <div key={m.value} className="flex flex-col-reverse justify-end">
                <dt className="text-sm text-gray-600">{m.caption}</dt>
                <dd className={`text-base sm:text-2xl font-bold leading-tight ${m.color}`}>{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Tools. A div, not <main>: Layout already renders the page's <main>. */}
      <div className="flex-grow">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-14">
          <section aria-labelledby="live-heading">
            <SectionHeading
              id="live-heading"
              title="Available now"
              subtitle="Everything runs on-device in any modern browser. Decide uses WebGPU when available."
            />
            <div className="flex flex-col gap-6">
              {flagship && <DecideFlagshipCard demo={flagship} />}
              <div className="grid md:grid-cols-2 gap-6">
                {others.map((demo) => (
                  <ToolCard key={demo.id} demo={demo} />
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="planned-heading">
            <SectionHeading id="planned-heading" title="Planned" subtitle="Next on Transformers.js v4." />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plannedDemos.map((demo) => (
                <PlannedCard key={demo.id} demo={demo} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Footer, as donbr.github.io's Layout footer. Rendered here (not via Layout's footer
          prop) so demo routes keep their full height. */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="flex flex-col gap-1">
            <p>&copy; {new Date().getFullYear()} Don Branson. All rights reserved.</p>
            <p className="text-sm text-gray-300">
              Built on{' '}
              <a
                href="https://github.com/huggingface/transformers.js-examples"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline underline-offset-2"
              >
                huggingface/transformers.js-examples
              </a>
              .
            </p>
          </div>
          <div className="flex space-x-4">
            <a href="https://github.com/donbr" className="text-gray-300 hover:text-white" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/donbranson/"
              className="text-gray-300 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a href="https://huggingface.co/dwb2023" className="text-gray-300 hover:text-white" target="_blank" rel="noopener noreferrer">
              Hugging Face
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
