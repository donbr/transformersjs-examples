import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { demoForPath, modelUrl, runtimeLabel } from './demos/registry.js';

// Site header, aligned with donbr.github.io's Layout.tsx (nav styles, 44px menu button,
// menu closing on navigation / Escape / lg). Differences forced by this app's shell:
// .layout-header has a fixed height, so the mobile panel is position:absolute under it
// instead of in flow. Nothing here may remount the routes or touch demo state.

const PORTFOLIO = 'https://donbr.github.io/';

const navItems = [
  { label: 'Portfolio', kind: 'external-site', href: PORTFOLIO },
  { label: 'Projects', kind: 'external-site', href: 'https://donbr.github.io/assets/projects' },
  { label: 'Tools', kind: 'route', to: '/' },
  { label: 'GitHub', kind: 'external', href: 'https://github.com/donbr/transformersjs-examples' },
];

const navStyles = {
  desktop: {
    base: 'self-stretch flex items-center px-2 whitespace-nowrap border-b-2 hover:text-gray-900',
    active: 'text-gray-900 border-blue-500',
    inactive: 'text-gray-500 border-transparent',
  },
  mobile: {
    base: 'flex items-center min-h-[44px] px-2 rounded-md text-base hover:bg-gray-50 hover:text-gray-900',
    active: 'text-gray-900 font-semibold bg-gray-50',
    inactive: 'text-gray-600',
  },
};

// lucide-react glyphs (menu, x, external-link) as inline SVG, so no icon dependency.
function Icon({ name, className }) {
  const paths = {
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    x: ['M18 6 6 18', 'm6 6 12 12'],
    external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  }[name];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
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

// Omitted for liveRuntime demos, whose page shows the device it actually loaded.
function RuntimePill({ demo }) {
  if (demo.liveRuntime) return null;
  return (
    <span className="shrink-0 text-xs font-bold uppercase tracking-wider px-1.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap">
      {runtimeLabel(demo.runtime)}
    </span>
  );
}

function NavLink({ item, variant, onNavigate }) {
  const styles = navStyles[variant];
  const { pathname } = useLocation();
  if (item.kind === 'route') {
    // Every page of this app is a tool, so "Tools" is always the current section: it is the
    // current *page* only on its own route, and the current item (aria-current="true") below it.
    return (
      <Link
        to={item.to}
        className={`${styles.base} ${styles.active}`}
        aria-current={pathname === item.to ? 'page' : 'true'}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  }
  if (item.kind === 'external') {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.base} ${variant === 'desktop' ? 'border-transparent' : ''} gap-1 text-blue-600 hover:text-blue-800`}
        onClick={onNavigate}
      >
        {item.label}
        <Icon name="external" className="w-3.5 h-3.5" />
      </a>
    );
  }
  return (
    <a href={item.href} className={`${styles.base} ${styles.inactive}`} onClick={onNavigate}>
      {item.label}
    </a>
  );
}

export default function SiteHeader() {
  const location = useLocation();
  const demo = demoForPath(location.pathname);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);

  // Any navigation closes the menu (link, back/forward, hash change). Reset during render,
  // as donbr.github.io does, keyed on the full location.
  const navKey = `${location.pathname}${location.search}${location.hash}:${location.key}`;
  const [menu, setMenu] = useState({ open: false, navKey });
  if (menu.navKey !== navKey) setMenu({ open: false, navKey });
  const menuOpen = menu.open && menu.navKey === navKey;
  const setMenuOpen = (open) => setMenu({ open, navKey });
  const closeMenu = () => setMenuOpen(false);

  // Escape closes the menu; if focus was inside it, return focus to the toggle.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (menuRef.current?.contains(document.activeElement)) menuButtonRef.current?.focus();
        setMenu((m) => ({ ...m, open: false }));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  // Close when the viewport reaches lg, where the panel is hidden.
  useEffect(() => {
    if (!menuOpen) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => {
      if (e.matches) setMenu((m) => ({ ...m, open: false }));
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, [menuOpen]);

  const separator = <span className="text-gray-300" aria-hidden="true">/</span>;

  return (
    <nav className="w-full h-full" aria-label="Primary">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* Breadcrumb. Below lg on demo routes the wordmark moves into the menu as "Portfolio".
            Links are inline-flex + items-center + shrink-0: index.css gives mobile links a 44px
            min-height and min-width, which would otherwise let them shrink under their text. */}
        <div className="flex items-center gap-2 min-w-0 text-base">
          <a
            href={PORTFOLIO}
            className={`shrink-0 items-center font-semibold text-gray-700 text-lg whitespace-nowrap hover:text-gray-900 ${demo ? 'hidden lg:inline-flex' : 'inline-flex'}`}
          >
            Don Branson
          </a>
          <span className={demo ? 'hidden lg:inline' : ''}>{separator}</span>
          <Link to="/" className="shrink-0 inline-flex items-center text-gray-700 whitespace-nowrap hover:text-gray-900">
            Transformers.js
          </Link>
          {demo && (
            <>
              {separator}
              <span className="font-semibold text-gray-900 truncate lg:shrink-0" aria-current="page">
                {demo.name}
              </span>
            </>
          )}
          {demo && (
            // Lowest priority in the row: the model id truncates before the demo name does.
            <span className="hidden xl:flex items-center gap-2 ml-2 min-w-0" title={demo.modelId}>
              <span className="font-mono text-sm bg-gray-100 px-1.5 rounded truncate min-w-0">{demo.modelName}</span>
              <RuntimePill demo={demo} />
            </span>
          )}
        </div>

        {/* Desktop links */}
        <div className="hidden lg:flex self-stretch items-stretch space-x-1 xl:space-x-3 text-sm xl:text-base">
          {navItems.map((item) => (
            <NavLink key={item.label} item={item} variant="desktop" />
          ))}
        </div>

        {/* Mobile menu button */}
        <button
          ref={menuButtonRef}
          type="button"
          className={`lg:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${menuOpen ? 'bg-gray-100' : ''}`}
          aria-controls="mobile-menu"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile panel: always rendered (hidden when closed) so aria-controls has a target.
          Absolute under the fixed-height header, above the content; no backdrop or scroll lock. */}
      <div
        id="mobile-menu"
        ref={menuRef}
        hidden={!menuOpen}
        className="lg:hidden absolute top-full left-0 right-0 z-20 bg-white border-t border-gray-200 shadow-lg"
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
          {navItems.map((item) => (
            <NavLink key={item.label} item={item} variant="mobile" onNavigate={closeMenu} />
          ))}
          {demo && (
            <div className="mt-2 pt-3 pb-1 px-2 border-t border-gray-200 flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Model</span>
              <span className="flex flex-wrap items-center gap-2">
                <a
                  href={modelUrl(demo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-mono text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800"
                >
                  {demo.modelName}
                </a>
                <RuntimePill demo={demo} />
              </span>
              <span className="text-xs text-gray-500 break-words">{demo.modelId}</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
