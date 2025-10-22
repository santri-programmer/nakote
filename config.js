// config.js - Environment Configuration for Jimpitan PWA
const CONFIG = {
  // Development Environment
  development: {
    API_URL: "http://localhost:8080/api",
    ENV: "development",
    DEBUG: true,
    CACHE_TTL: 300000, // 5 minutes
    RETRY_ATTEMPTS: 3,
    TIMEOUT: 30000,
  },

  // Production Environment
  production: {
    API_URL: "https://api.pnakote.my.id/api",
    ENV: "production",
    DEBUG: false,
    CACHE_TTL: 900000, // 15 minutes
    RETRY_ATTEMPTS: 2,
    TIMEOUT: 15000,
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

// Enhanced silent mode untuk production - no console logs
if (!window.APP_CONFIG.DEBUG) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  console.trace = noop;
}

// Secure logger utility dengan performance tracking
window.AppLogger = {
  log: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.log("🔍", ...args);
    }
  },

  error: (...args) => {
    // Always show errors, even in production
    console.error("❌", ...args);
  },

  warn: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.warn("⚠️", ...args);
    }
  },

  info: (...args) => {
    if (window.APP_CONFIG.DEBUG) {
      console.info("ℹ️", ...args);
    }
  },

  performance: (name, startTime) => {
    if (window.APP_CONFIG.DEBUG) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ ${name}: ${duration}ms`);
    }
  },
};

// API Service Helper
window.ApiHelper = {
  async request(endpoint, options = {}) {
    const startTime = Date.now();
    const maxRetries = window.APP_CONFIG.RETRY_ATTEMPTS;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          window.APP_CONFIG.TIMEOUT
        );

        const response = await fetch(
          `${window.APP_CONFIG.API_URL}${endpoint}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...options.headers,
            },
            signal: controller.signal,
            ...options,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle specific HTTP status codes
          if (response.status === 401) {
            // Token expired - redirect to login
            if (window.location.pathname.includes("admin")) {
              localStorage.removeItem("adminToken");
              window.location.href = "../index.html";
            }
            throw new Error("Session expired. Please login again.");
          } else if (response.status === 429) {
            throw new Error("Too many requests. Please try again later.");
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.");
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
        }

        const data = await response.json();
        window.AppLogger.performance(`API: ${endpoint}`, startTime);
        return data;
      } catch (error) {
        window.AppLogger.error(
          `Attempt ${attempt}/${maxRetries} failed:`,
          error
        );

        if (attempt === maxRetries) {
          if (error.name === "AbortError") {
            throw new Error("Request timeout. Please check your connection.");
          }
          throw error;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  },
};
