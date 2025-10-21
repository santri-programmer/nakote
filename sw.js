// Service Worker for Jimpitan PWA
const CACHE_NAME = "jimpitan-pwa-v2.0";
const API_CACHE_NAME = "jimpitan-api-v2";

// Assets to cache immediately on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/admin/dashboard.html",
  "/admin/admin.js",
  "/admin/admin.css",
  "/manifest.json",
  "/icons/icon-72x72.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.tailwindcss.com",
];

// Install event - cache core assets
self.addEventListener("install", (event) => {
  console.log("🟢 Service Worker installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Caching static assets...");
        return cache.addAll([...STATIC_ASSETS, ...EXTERNAL_RESOURCES]);
      })
      .then(() => {
        console.log("✅ All assets cached");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("❌ Cache installation failed:", error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener("activate", (event) => {
  console.log("🟢 Service Worker activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Service Worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Handle API requests
  if (event.request.url.includes("/api/")) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(event.request));
});

// Strategy for API requests: Network first, then cache
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // If successful, cache the response
    if (networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log("🌐 Network failed, trying cache...");
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log("✅ Serving from cache:", request.url);
      return cachedResponse;
    }

    // Neither network nor cache available
    return new Response(
      JSON.stringify({
        error: "You are offline and no cached data is available",
        suggestion: "Check your internet connection",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Strategy for static assets: Cache first, then network
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Serve from cache
    return cachedResponse;
  }

  try {
    // Try network
    const networkResponse = await fetch(request);

    // Cache the new resource
    if (networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    // Network failed
    console.log("❌ Network failed for:", request.url);

    // For navigation requests, return offline page
    if (request.mode === "navigate") {
      return caches.match("/offline.html");
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

// Background sync for offline data
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  if (event.tag === "sync-pending-donasi") {
    event.waitUntil(syncPendingDonasi());
  }
});

// Sync pending donations when back online
async function syncPendingDonasi() {
  try {
    // Get pending donations from IndexedDB or localStorage
    const pendingDonasi = await getPendingDonasi();
    console.log(`🔄 Syncing ${pendingDonasi.length} pending donations...`);

    for (const donasi of pendingDonasi) {
      try {
        const response = await fetch("/api/donasi", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Offline-Sync": "true",
          },
          body: JSON.stringify(donasi.data),
        });

        if (response.ok) {
          console.log("✅ Successfully synced donation:", donasi.id);
          await removePendingDonasi(donasi.id);

          // Show notification
          self.registration.showNotification("Sync Berhasil", {
            body: `Donasi ${donasi.data.nama_donatur} berhasil disinkronisasi`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
          });
        } else {
          console.error("❌ Sync failed for donation:", donasi.id);
        }
      } catch (error) {
        console.error("❌ Error syncing donation:", error);
      }
    }
  } catch (error) {
    console.error("❌ Background sync error:", error);
  }
}

// Helper functions for pending donations
async function getPendingDonasi() {
  return new Promise((resolve) => {
    // Using IndexedDB for better offline storage
    const request = indexedDB.open("JimpitanDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pendingDonasi")) {
        db.createObjectStore("pendingDonasi", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(["pendingDonasi"], "readonly");
      const store = transaction.objectStore("pendingDonasi");
      const getAll = store.getAll();

      getAll.onsuccess = () => resolve(getAll.result || []);
    };

    request.onerror = () => resolve([]);
  });
}

async function removePendingDonasi(id) {
  return new Promise((resolve) => {
    const request = indexedDB.open("JimpitanDB", 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(["pendingDonasi"], "readwrite");
      const store = transaction.objectStore("pendingDonasi");
      const deleteReq = store.delete(id);

      deleteReq.onsuccess = () => resolve(true);
      deleteReq.onerror = () => resolve(false);
    };

    request.onerror = () => resolve(false);
  });
}

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: data.url,
    actions: [
      {
        action: "open",
        title: "Buka Aplikasi",
      },
      {
        action: "close",
        title: "Tutup",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "open") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === "/" && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
    );
  }
});
