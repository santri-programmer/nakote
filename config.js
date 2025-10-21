// config.js - Environment Configuration for Jimpitan PWA
const CONFIG = {
  // Development Environment
  development: {
    API_URL: "http://localhost:8080/api",
    ENV: "development",
    DEBUG: true
  },
  
  // Production Environment  
  production: {
    API_URL: "https://api.pnakote.my.id/api",
    ENV: "production",
    DEBUG: false
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

// Silent mode untuk production - no console logs
if (!window.APP_CONFIG.DEBUG) {
  console.log = function() {};
  console.info = function() {};
  console.warn = function() {};
}

// Secure logger utility
window.AppLogger = {
  log: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.log('🔍', ...args);
    }
  },
  
  error: (...args) => {
    console.error('❌', ...args);
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
  }
};
