// Vercel Speed Insights
// This script is injected into Swagger UI to track Web Vitals
(function() {
  // Only load in production on Vercel
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    try {
      // Load Speed Insights from Vercel CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.vercel.com/insights/script.js';
      script.defer = true;
      script.setAttribute('data-api', '/_vercel/insights/script');
      
      // Add error handling
      script.onerror = function() {
        console.warn('[Vercel Speed Insights] Failed to load script');
      };
      
      script.onload = function() {
        console.log('[Vercel Speed Insights] Script loaded successfully');
      };
      
      document.head.appendChild(script);
    } catch (error) {
      console.warn('[Vercel Speed Insights] Error initializing:', error);
    }
  }
})();

