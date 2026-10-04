import React, { useLayoutEffect, useRef } from 'react';

export default function Layout({ header, children, footer }) {
  const contentRef = useRef(null);

  // Width of .layout-content's scrollbar (0 for overlay scrollbars). The header pads by it so
  // centred content lines up under the header's content. Measured before paint so the header
  // never shifts, and again whenever the content box changes size: a window resize, or a
  // scrollbar appearing or disappearing in browsers without `scrollbar-gutter: stable`.
  // (--vh for mobile browsers is owned by utils/ViewportHeightFix.jsx.)
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const update = () => {
      const scrollbar = content.offsetWidth - content.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbar}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="layout-container">
      {header && <header className="layout-header">{header}</header>}
      <main ref={contentRef} className="layout-content">{children}</main>
      {footer && <footer className="layout-footer">{footer}</footer>}
    </div>
  );
}
