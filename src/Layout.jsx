import React, { useEffect } from 'react';

export default function Layout({ header, children, footer }) {
  useEffect(() => {
    // Fix for mobile browsers that change height when address bar shows/hides
    const updateHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return (
    <div className="layout-container">
      {header && <header className="layout-header">{header}</header>}
      <main className="layout-content">{children}</main>
      {footer && <footer className="layout-footer">{footer}</footer>}
    </div>
  );
}
