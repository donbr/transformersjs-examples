import React, { useEffect, useRef } from 'react';

export default function Layout({ header, children, footer }) {
  const contentRef = useRef(null);

  useEffect(() => {
    const update = () => {
      // Fix for mobile browsers that change height when address bar shows/hides
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);

      // Width of .layout-content's reserved scrollbar gutter (0 for overlay scrollbars). The
      // header pads by it so centred content lines up under the header's content.
      const content = contentRef.current;
      if (content) {
        const scrollbar = content.offsetWidth - content.clientWidth;
        document.documentElement.style.setProperty('--scrollbar-width', `${scrollbar}px`);
      }
    };

    update();
    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="layout-container">
      {header && <header className="layout-header">{header}</header>}
      <main ref={contentRef} className="layout-content">{children}</main>
      {footer && <footer className="layout-footer">{footer}</footer>}
    </div>
  );
}
