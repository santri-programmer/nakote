// PWA Manager for Jimpitan Application
class JimpitanPWA {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.serviceWorkerRegistration = null;
    this.init();
  }

  async init() {
    if (window.APP_CONFIG?.DEBUG) {
      console.log("🚀 Initializing Jimpitan PWA...");
    }

    // Register Service Worker
    await this.registerServiceWorker();

    // Setup install prompt
    this.setupInstallPrompt();

    // Setup online/offline detection
    this.setupConnectivity();

    // Check if app is already installed
    this.checkIfInstalled();

    // Initialize offline functionality
    this.setupOfflineFunctionality();

    if (window.APP_CONFIG?.DEBUG) {
      console.log("✅ Jimpitan PWA initialized");
    }
  }

  // Register Service Worker
  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register("/nakote/sw.js");
        
        if (window.APP_CONFIG?.DEBUG) {
          console.log("🟢 Service Worker registered:", this.serviceWorkerRegistration);
        }

        // Check for updates
        this.serviceWorkerRegistration.addEventListener("updatefound", () => {
          const newWorker = this.serviceWorkerRegistration.installing;
          
          if (window.APP_CONFIG?.DEBUG) {
            console.log("🔄 New Service Worker found:", newWorker);
          }

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              this.showUpdateNotification();
            }
          });
        });
      } catch (error) {
        console.error("❌ Service Worker registration failed:", error);
      }
    } else {
      if (window.APP_CONFIG?.DEBUG) {
        console.warn("⚠️ Service Workers not supported");
      }
    }
  }

  // Handle app installation prompt
  setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      if (window.APP_CONFIG?.DEBUG) {
        console.log("📱 Install prompt triggered");
      }
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPromotion();
    });

    window.addEventListener("appinstalled", () => {
      if (window.APP_CONFIG?.DEBUG) {
        console.log("✅ PWA installed successfully");
      }
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallPromotion();
      this.showNotification(
        "Aplikasi Terinstall!",
        "Jimpitan berhasil diinstall ke device Anda."
      );
    });
  }

  // Show install promotion
  showInstallPromotion() {
    // Don't show if already installed or in standalone mode
    if (
      this.isInstalled ||
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      return;
    }

    const existingPromotion = document.getElementById("pwa-install-promotion");
    if (existingPromotion) return;

    const promotion = document.createElement("div");
    promotion.id = "pwa-install-promotion";
    promotion.innerHTML = `
      <div class="fixed bottom-4 left-4 right-4 bg-white border border-purple-200 rounded-xl shadow-lg p-4 z-50 max-w-md mx-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i class="fas fa-mobile-alt text-purple-600 text-lg"></i>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 text-sm">Install Aplikasi</h3>
              <p class="text-gray-600 text-xs">Akses lebih cepat dengan install aplikasi</p>
            </div>
          </div>
          <div class="flex space-x-2">
            <button id="pwa-install-later" class="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors">
              Nanti
            </button>
            <button id="pwa-install-now" class="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors">
              Install
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(promotion);

    // Add event listeners
    document.getElementById("pwa-install-now").addEventListener("click", () => {
      this.installApp();
    });

    document
      .getElementById("pwa-install-later")
      .addEventListener("click", () => {
        this.hideInstallPromotion();
        // Show again after 1 day
        setTimeout(() => this.showInstallPromotion(), 24 * 60 * 60 * 1000);
      });

    // Auto hide after 30 seconds
    setTimeout(() => {
      this.hideInstallPromotion();
    }, 30000);
  }

  hideInstallPromotion() {
    const promotion = document.getElementById("pwa-install-promotion");
    if (promotion) {
      promotion.remove();
    }
  }

  // Install app
  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (window.APP_CONFIG?.DEBUG) {
        console.log(`User responded to install prompt: ${outcome}`);
      }

      if (outcome === "accepted") {
        this.isInstalled = true;
        this.trackEvent("pwa_install", "accepted");
      } else {
        this.trackEvent("pwa_install", "dismissed");
      }

      this.deferredPrompt = null;
      this.hideInstallPromotion();
    }
  }

  // Check if app is installed
  checkIfInstalled() {
    // Check if in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches) {
      this.isInstalled = true;
      if (window.APP_CONFIG?.DEBUG) {
        console.log("📱 App running in standalone mode");
      }
      return;
    }

    // Check if launched from home screen
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      if (window.APP_CONFIG?.DEBUG) {
        console.log("📱 App launched from home screen");
      }
      return;
    }

    // Check localStorage
    if (localStorage.getItem("jimpitan_pwa_installed") === "true") {
      this.isInstalled = true;
    }
  }

  // Online/offline detection
  setupConnectivity() {
    window.addEventListener("online", () => {
      if (window.APP_CONFIG?.DEBUG) {
        console.log("🌐 App is online");
      }
      this.isOnline = true;
      this.showOnlineStatus();
      this.syncOfflineData();
    });

    window.addEventListener("offline", () => {
      if (window.APP_CONFIG?.DEBUG) {
        console.log("📴 App is offline");
      }
      this.isOnline = false;
      this.showOfflineStatus();
    });

    // Initial status
    if (this.isOnline) {
      this.showOnlineStatus();
    } else {
      this.showOfflineStatus();
    }
  }

  showOnlineStatus() {
    this.showNotification("Koneksi Pulih", "Anda kembali online.", "success");

    // Update UI
    const offlineIndicator = document.getElementById("offline-indicator");
    if (offlineIndicator) {
      offlineIndicator.style.display = "none";
    }
  }

  showOfflineStatus() {
    this.showNotification(
      "Mode Offline",
      "Anda sedang offline. Data akan disinkronisasi saat online.",
      "warning"
    );

    // Create or show offline indicator
    let offlineIndicator = document.getElementById("offline-indicator");
    if (!offlineIndicator) {
      offlineIndicator = document.createElement("div");
      offlineIndicator.id = "offline-indicator";
      offlineIndicator.innerHTML = `
        <div class="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm z-40">
          <i class="fas fa-wifi mr-2"></i>Anda sedang offline
        </div>
      `;
      document.body.appendChild(offlineIndicator);
    } else {
      offlineIndicator.style.display = "block";
    }
  }

  // Offline functionality
  setupOfflineFunctionality() {
    // Intercept form submissions for offline handling
    this.setupOfflineForms();

    // Setup periodic sync
    this.setupPeriodicSync();
  }

  setupOfflineForms() {
    // This will be integrated with the existing form handlers
    if (window.APP_CONFIG?.DEBUG) {
      console.log("🔧 Setting up offline forms...");
    }
  }

  async setupPeriodicSync() {
    if (this.serviceWorkerRegistration && "periodicSync" in this.serviceWorkerRegistration) {
      try {
        await this.serviceWorkerRegistration.periodicSync.register("sync-pending-donasi", {
          minInterval: 24 * 60 * 60 * 1000, // 1 day
        });
        if (window.APP_CONFIG?.DEBUG) {
          console.log("✅ Periodic sync registered");
        }
      } catch (error) {
        if (window.APP_CONFIG?.DEBUG) {
          console.log("❌ Periodic sync not supported:", error);
        }
      }
    } else {
      if (window.APP_CONFIG?.DEBUG) {
        console.log("⚠️ Periodic sync not available");
      }
    }
  }

  // Save data for offline sync
  async saveForOfflineSync(dataType, data) {
    if (this.isOnline) return false;

    try {
      const db = await this.openDB();
      const transaction = db.transaction(["pendingData"], "readwrite");
      const store = transaction.objectStore("pendingData");

      const pendingItem = {
        id: Date.now(),
        type: dataType,
        data: data,
        timestamp: new Date().toISOString(),
      };

      await store.add(pendingItem);
      
      if (window.APP_CONFIG?.DEBUG) {
        console.log("💾 Data saved for offline sync:", pendingItem);
      }

      // Register background sync
      if (this.serviceWorkerRegistration && "sync" in this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.sync.register("sync-pending-data");
      }

      return true;
    } catch (error) {
      console.error("❌ Error saving for offline sync:", error);
      return false;
    }
  }

  // Sync offline data when back online
  async syncOfflineData() {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(["pendingData"], "readonly");
      const store = transaction.objectStore("pendingData");
      const allData = await store.getAll();

      if (window.APP_CONFIG?.DEBUG) {
        console.log(`🔄 Syncing ${allData.length} offline items...`);
      }

      for (const item of allData) {
        await this.syncItem(item);
      }
    } catch (error) {
      console.error("❌ Error syncing offline data:", error);
    }
  }

  async syncItem(item) {
    try {
      let endpoint, method;

      switch (item.type) {
        case "donasi":
          endpoint = "/api/donasi";
          method = "POST";
          break;
        default:
          if (window.APP_CONFIG?.DEBUG) {
            console.warn("Unknown sync type:", item.type);
          }
          return;
      }

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });

      if (response.ok) {
        // Remove from pending data
        await this.removePendingItem(item.id);
        if (window.APP_CONFIG?.DEBUG) {
          console.log("✅ Successfully synced:", item.id);
        }
      } else {
        if (window.APP_CONFIG?.DEBUG) {
          console.error("❌ Sync failed for:", item.id);
        }
      }
    } catch (error) {
      console.error("❌ Error syncing item:", error);
    }
  }

  // IndexedDB helper
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("JimpitanPWA", 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("pendingData")) {
          const store = db.createObjectStore("pendingData", { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async removePendingItem(id) {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(["pendingData"], "readwrite");
      const store = transaction.objectStore("pendingData");
      await store.delete(id);
    } catch (error) {
      console.error("Error removing pending item:", error);
    }
  }

  // Utility functions
  showNotification(title, message, type = "info") {
    // Use browser notifications if granted
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: "/nakote/icons/icon-192x192.png",
      });
    } else {
      // Fallback to custom notification
      this.showCustomNotification(title, message, type);
    }
  }

  showCustomNotification(title, message, type = "info") {
    const notification = document.createElement("div");
    const bgColor =
      type === "success"
        ? "bg-green-500"
        : type === "warning"
        ? "bg-yellow-500"
        : type === "error"
        ? "bg-red-500"
        : "bg-blue-500";

    notification.innerHTML = `
      <div class="fixed top-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm transform transition-transform duration-300 translate-x-0">
        <div class="flex items-start space-x-3">
          <i class="fas ${this.getNotificationIcon(type)} mt-1"></i>
          <div>
            <h4 class="font-semibold">${title}</h4>
            <p class="text-sm opacity-90">${message}</p>
          </div>
          <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.transform = "translate-x-full";
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  getNotificationIcon(type) {
    switch (type) {
      case "success":
        return "fa-check-circle";
      case "warning":
        return "fa-exclamation-triangle";
      case "error":
        return "fa-exclamation-circle";
      default:
        return "fa-info-circle";
    }
  }

  showUpdateNotification() {
    this.showCustomNotification(
      "Update Tersedia",
      "Versi baru aplikasi tersedia. Refresh untuk update.",
      "info"
    );
  }

  trackEvent(event, value) {
    // Analytics tracking
    if (window.APP_CONFIG?.DEBUG) {
      console.log(`📊 Event: ${event} = ${value}`);
    }
  }

  // Public methods
  getPWAStatus() {
    return {
      installed: this.isInstalled,
      online: this.isOnline,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
    };
  }
}

// Initialize PWA
const jimpitanPWA = new JimpitanPWA();

// Make it globally available
window.jimpitanPWA = jimpitanPWA;
