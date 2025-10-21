// config.js - Environment Configuration for Jimpitan PWA
const CONFIG = {
  // Development Environment
  development: {
    API_URL: "http://localhost:8080/api",
    ENV: "development",
    DEBUG: true,
    LOG_LEVEL: "debug",
  },

  // Production Environment
  production: {
    API_URL: "https://api.pnakote.my.id/api",
    ENV: "production",
    DEBUG: false,
    LOG_LEVEL: "error",
  },
};

// Auto-detect environment
const getConfig = () => {
  const hostname = window.location.hostname;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("192.168.")
  ) {
    return CONFIG.development;
  } else {
    return CONFIG.production;
  }
};

// Global configuration object
window.APP_CONFIG = getConfig();

// Logger utility
window.AppLogger = {
  log: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.log("🔍", ...args);
    }
  },

  error: (...args) => {
    console.error("❌", ...args);
  },

  warn: (...args) => {
    console.warn("⚠️", ...args);
  },

  info: (...args) => {
    console.info("ℹ️", ...args);
  },
};

console.log(`🎯 Jimpitan PWA - Environment: ${window.APP_CONFIG.ENV}`);
console.log(`🌐 API URL: ${window.APP_CONFIG.API_URL}`);
