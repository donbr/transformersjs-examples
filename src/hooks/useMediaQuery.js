import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design
 * @param {string} query - CSS media query string e.g. '(min-width: 768px)'
 * @returns {boolean} Whether the media query matches
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener for changes
    const handler = (event) => setMatches(event.matches);
    
    // Modern browsers
    mediaQuery.addEventListener('change', handler);
    
    // Cleanup function
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Export common breakpoints
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
