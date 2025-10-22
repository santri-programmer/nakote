// config.js - Environment Configuration for Jimpitan PWA
const CONFIG = {
  // Development Environment
  development: {
    API_URL: "http://localhost:8080/api",
    ENV: "development",
    DEBUG: true,
    CACHE_TTL: 300000, // 5 minutes
    RETRY_ATTEMPTS: 3,
    TIMEOUT: 30000
  },
  
  // Production Environment  
  production: {
    API_URL: "https://api.pnakote.my.id/api",
    ENV: "production",
    DEBUG: false,
    CACHE_TTL: 900000, // 15 minutes
    RETRY_ATTEMPTS: 2,
    TIMEOUT: 15000
  }
};

// Auto-detect environment
const getConfig = () => {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.')) {
    return CONFIG.development;
  } else {
    return CONFIG.production;
  }
};

// Global configuration object
window.APP_CONFIG = getConfig();

// Enhanced security untuk production - disable console dan debug tools
if (!window.APP_CONFIG.DEBUG) {
  // Disable console methods
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  console.trace = noop;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
  
  // Prevent opening DevTools
  (function() {
    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    document.addEventListener('keydown', function(e) {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C')
      ) {
        e.preventDefault();
        return false;
      }
    });
    
    // Disable right-click context menu
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    
    // Clear console on load
    console.clear();
  })();
}

// Secure logger utility dengan production safety
window.AppLogger = {
  log: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.log('🔍', ...args);
    }
  },
  
  error: (...args) => {
    // Only show critical errors in production
    if (window.APP_CONFIG.DEBUG) {
      console.error('❌', ...args);
    }
    // In production, you might want to send errors to monitoring service
  },
  
  warn: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.warn('⚠️', ...args);
    }
  },
  
  info: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.info('ℹ️', ...args);
    }
  },
  
  performance: (name, startTime) => {
    if (window.APP_CONFIG.DEBUG) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ ${name}: ${duration}ms`);
    }
  }
};

// API Service Helper dengan security headers
window.ApiHelper = {
  async request(endpoint, options = {}) {
    const startTime = Date.now();
    const maxRetries = window.APP_CONFIG.RETRY_ATTEMPTS;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), window.APP_CONFIG.TIMEOUT);
        
        const response = await fetch(`${window.APP_CONFIG.API_URL}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: controller.signal,
          ...options,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle specific HTTP status codes
          if (response.status === 401) {
            // Token expired - redirect to login
            if (window.location.pathname.includes('admin')) {
              localStorage.removeItem('adminToken');
              window.location.href = '../index.html';
            }
            throw new Error('Session expired. Please login again.');
          } else if (response.status === 429) {
            throw new Error('Too many requests. Please try again later.');
          } else if (response.status >= 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        }
        
        const data = await response.json();
        window.AppLogger.performance(`API: ${endpoint}`, startTime);
        return data;
        
      } catch (error) {
        window.AppLogger.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt === maxRetries) {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout. Please check your connection.');
          }
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }
};

// Security: Remove debug functions from global scope in production
if (!window.APP_CONFIG.DEBUG) {
  setTimeout(() => {
    if (window.adminDebug) {
      delete window.adminDebug;
    }
    if (window.jimpitanPWA && window.jimpitanPWA.trackEvent) {
      window.jimpitanPWA.trackEvent = () => {};
    }
  }, 1000);
}
