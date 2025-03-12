import React, { useEffect } from 'react';

/**
 * Component that fixes viewport height issues on mobile browsers
 * This addresses the problem where mobile browser address bars can 
 * affect the viewport height dynamically
 */
export default function ViewportHeightFix() {
  useEffect(() => {
    // Function to update CSS variable with the current viewport height
    const updateViewportHeight = () => {
      // Get viewport height
      const vh = window.innerHeight * 0.01;
      // Set the --vh CSS variable
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Set initial value
    updateViewportHeight();

    // Update on resize and orientation change
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
