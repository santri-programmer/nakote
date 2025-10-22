// Admin Dashboard - Production Ready dengan Security Enhancements
const API_URL = window.APP_CONFIG?.API_URL || "https://api.pnakote.my.id/api";
const APP_LOGGER = window.AppLogger || console;

// Cache untuk performance
let reportCache = new Map();
let domCache = new Map();

// Security: Hide debug functions in production
const safeApiRequest = async (endpoint, options = {}) => {
  if (window.ApiHelper && typeof window.ApiHelper.request === 'function') {
    return window.ApiHelper.request(endpoint, options);
  } else if (window.safeApiRequest) {
    return window.safeApiRequest(endpoint, options);
  } else {
    // Fallback ke fetch langsung
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
};

if (!window.APP_CONFIG?.DEBUG) {
  // Remove debug utilities from global scope
  const originalConsole = console;
  console = {
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {}, // Keep errors minimal in production
    trace: () => {},
    table: () => {},
    group: () => {},
    groupEnd: () => {},
    groupCollapsed: () => {},
    clear: () => {}
  };
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAdminDashboard);
} else {
  initializeAdminDashboard();
}

document.addEventListener("DOMContentLoaded", () => {
  // Only log in development mode
  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("🚀 Admin Dashboard Initializing...");
  }
  
  initializeAdminDashboard();
});

function initializeAdminDashboard() {
  const startTime = Date.now();
  
  // Safety check - pastikan dependencies sudah loaded
  if (!window.APP_CONFIG) {
    console.error('❌ APP_CONFIG not found. Make sure config.js is loaded first.');
    showNotification('Configuration error. Please refresh the page.', false);
    return;
  }
  
  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("🚀 Admin Dashboard Initializing...");
    APP_LOGGER.log("🔧 ApiHelper available:", !!window.ApiHelper);
  }
  
  // Cache DOM elements
  cacheDOMElements();
  
  // Set tanggal default ke hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("filterTanggal").value = today;

  // Load data saat pertama kali buka
  loadInitialData();

  // Setup event listeners dengan event delegation
  setupEventListeners();
  
  // Update info text berdasarkan periode
  updateTanggalInfo();
  
  if (window.APP_CONFIG?.DEBUG) {
    window.AppLogger.performance("Admin Dashboard Initialization", startTime);
  }
}

function cacheDOMElements() {
  const elements = {
    filterKategori: document.getElementById("filterKategori"),
    filterPeriode: document.getElementById("filterPeriode"),
    filterTanggal: document.getElementById("filterTanggal"),
    btnGenerate: document.getElementById("btnGenerate"),
    btnExportPDF: document.getElementById("btnExportPDF"),
    btnExportExcel: document.getElementById("btnExportExcel"),
    infoText: document.getElementById("infoText"),
    btnLogout: document.getElementById("btnLogout"),
    tabelLaporan: document.getElementById("tabelLaporan"),
    totalLaporan: document.getElementById("totalLaporan")
  };
  
  // Store in domCache for reuse
  domCache.set('elements', elements);
}

function getElement(id) {
  const elements = domCache.get('elements') || {};
  return elements[id] || document.getElementById(id);
}

function setupEventListeners() {
  // Event delegation untuk performance
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btnGenerate')) {
      generateLaporan();
    } else if (e.target.closest('#btnExportPDF')) {
      exportLaporan("pdf");
    } else if (e.target.closest('#btnExportExcel')) {
      exportLaporan("xlsx");
    } else if (e.target.closest('#btnLogout')) {
      handleLogout();
    }
  });

  // Event listeners untuk real-time updates
  getElement('filterKategori').addEventListener("change", () => {
    updateUIState();
  });

  getElement('filterPeriode').addEventListener("change", () => {
    updateTanggalInfo();
    updateUIState();
  });

  getElement('filterTanggal').addEventListener("change", () => {
    updateUIState();
  });
}

function handleLogout() {
  if (confirm("Apakah Anda yakin ingin logout?")) {
    localStorage.removeItem("adminToken");
    window.location.href = "../index.html";
  }
}

// Update info text berdasarkan periode yang dipilih
function updateTanggalInfo() {
  const periode = getElement('filterPeriode').value;
  const infoText = getElement('infoText');

  switch (periode) {
    case "harian":
      infoText.textContent = "Pilih tanggal spesifik untuk laporan harian";
      break;
    case "mingguan":
      infoText.textContent =
        "Pilih tanggal di minggu yang diinginkan (akan menampilkan data seminggu dari Senin-Minggu)";
      break;
    case "bulanan":
      infoText.textContent =
        "Pilih tanggal di bulan yang diinginkan (akan menampilkan data sebulan penuh)";
      break;
    default:
      infoText.textContent = "Pilih periode laporan";
  }
}

// Fungsi untuk load data awal dengan caching
async function loadInitialData() {
  const cacheKey = 'initial-data-harian-semua';
  
  if (reportCache.has(cacheKey)) {
    renderTabel(reportCache.get(cacheKey));
    showNotification("Data laporan berhasil dimuat dari cache", true);
    return;
  }

  try {
    showLoadingState(true);
    const data = await getLaporan("semua", "harian", "");
    reportCache.set(cacheKey, data);
    renderTabel(data);
    showNotification("Data laporan berhasil dimuat", true);
  } catch (error) {
    showNotification("Gagal memuat data awal: " + error.message, false);
  } finally {
    showLoadingState(false);
  }
}

// Fungsi utama generate laporan dengan caching
async function generateLaporan() {
  const kategori = getElement('filterKategori').value;
  const periode = getElement('filterPeriode').value;
  const tanggal = getElement('filterTanggal').value;

  if (!kategori || !periode || !tanggal) {
    showNotification(
      "Pilih kategori, periode, dan tanggal terlebih dahulu",
      false
    );
    return;
  }

  const cacheKey = `${periode}-${kategori}-${tanggal}`;
  
  // Check cache first
  if (reportCache.has(cacheKey)) {
    const cachedData = reportCache.get(cacheKey);
    renderTabel(cachedData);
    showNotification(
      `Laporan ${periode} untuk ${kategori} berhasil dimuat dari cache`,
      true
    );
    return;
  }

  try {
    showLoadingState(true);

    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("🔄 Generate Laporan Params:", {
        kategori: kategori,
        periode: periode,
        tanggal: tanggal,
      });
    }

    const data = await getLaporan(kategori, periode, tanggal);

    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("📊 Data Received:", data);
    }

    if (data && data.length > 0) {
      // Cache the result
      reportCache.set(cacheKey, data);
      renderTabel(data);
      showNotification(
        `Laporan ${periode} untuk ${kategori} berhasil digenerate`,
        true
      );
    } else {
      renderTabel([]);
      showNotification(
        `Tidak ada data untuk ${kategori} periode ${periode} pada tanggal ${formatTanggalDisplay(
          tanggal
        )}`,
        "info"
      );
    }
  } catch (error) {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.error("❌ Error generating report:", error);
    }
    showNotification("Gagal generate laporan: " + error.message, false);
  } finally {
    showLoadingState(false);
  }
}

// Fungsi export laporan
async function exportLaporan(format) {
  const kategori = getElement('filterKategori').value;
  const periode = getElement('filterPeriode').value;
  const tanggal = getElement('filterTanggal').value;

  if (!kategori || !periode || !tanggal) {
    showNotification(
      "Pilih kategori, periode, dan tanggal terlebih dahulu",
      false
    );
    return;
  }

  try {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log(`📤 Export ${format.toUpperCase()} Params:`, {
        format: format,
        kategori: kategori,
        periode: periode,
        tanggal: tanggal,
      });
    }

    // Test koneksi sebelum export
    const testData = await getLaporan(kategori, periode, tanggal);
    if (!testData || testData.length === 0) {
      showNotification("Tidak ada data untuk di-export", "info");
      return;
    }

    // Build export URL
    const url = `${API_URL}/laporan/export?format=${format}&periode=${periode}&kategori=${encodeURIComponent(
      kategori
    )}&tanggal=${tanggal}`;
    
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("🔗 Export URL:", url);
    }

    // Buka tab baru untuk export
    const newWindow = window.open(url, "_blank");

    if (!newWindow) {
      throw new Error("Popup diblokir. Izinkan popup untuk situs ini.");
    }

    showNotification(
      `Export ${format.toUpperCase()} berhasil dibuka di tab baru`,
      true
    );
  } catch (error) {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.error(`❌ Error exporting ${format}:`, error);
    }
    showNotification(`Gagal export ${format}: ` + error.message, false);
  }
}

// Fungsi get data laporan dari API dengan parameter tanggal
async function getLaporan(kategori, periode, tanggal) {
  try {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("📡 Fetching laporan:", { kategori, periode, tanggal });
    }

    // Build URL dengan parameter tanggal
    let url = `/laporan?periode=${periode}&kategori=${encodeURIComponent(
      kategori
    )}`;
    if (tanggal) {
      url += `&tanggal=${tanggal}`;
    }

    // Use safeApiRequest dengan fallback mechanism
    const result = await safeApiRequest(url, {
      method: "GET"
    });

    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("✅ API Response:", result);
    }

    // Handle different response formats
    if (result.success !== undefined) {
      return result.data || [];
    } else if (Array.isArray(result)) {
      return result;
    } else {
      if (window.APP_CONFIG?.DEBUG) {
        APP_LOGGER.warn("⚠️ Unknown response format:", result);
      }
      return [];
    }
  } catch (error) {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.error("❌ Error fetching laporan:", error);
    }
    throw error;
  }
}

// Fungsi export laporan
async function exportLaporan(format) {
  const kategori = getElement('filterKategori').value;
  const periode = getElement('filterPeriode').value;
  const tanggal = getElement('filterTanggal').value;

  if (!kategori || !periode || !tanggal) {
    showNotification(
      "Pilih kategori, periode, dan tanggal terlebih dahulu",
      false
    );
    return;
  }

  try {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log(`📤 Export ${format.toUpperCase()} Params:`, {
        format: format,
        kategori: kategori,
        periode: periode,
        tanggal: tanggal,
      });
    }

    // Test koneksi sebelum export menggunakan ApiHelper
    const testData = await getLaporan(kategori, periode, tanggal);
    if (!testData || testData.length === 0) {
      showNotification("Tidak ada data untuk di-export", "info");
      return;
    }

    // Build export URL
    const url = `${API_URL}/laporan/export?format=${format}&periode=${periode}&kategori=${encodeURIComponent(
      kategori
    )}&tanggal=${tanggal}`;
    
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("🔗 Export URL:", url);
    }

    // Buka tab baru untuk export
    const newWindow = window.open(url, "_blank");

    if (!newWindow) {
      throw new Error("Popup diblokir. Izinkan popup untuk situs ini.");
    }

    showNotification(
      `Export ${format.toUpperCase()} berhasil dibuka di tab baru`,
      true
    );
  } catch (error) {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.error(`❌ Error exporting ${format}:`, error);
    }
    showNotification(`Gagal export ${format}: ` + error.message, false);
  }
}

// Fungsi get data laporan dari API dengan parameter tanggal
async function getLaporan(kategori, periode, tanggal) {
  try {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("📡 Fetching laporan:", { kategori, periode, tanggal });
    }

    // Build URL dengan parameter tanggal
    let url = `/laporan?periode=${periode}&kategori=${encodeURIComponent(
      kategori
    )}`;
    if (tanggal) {
      url += `&tanggal=${tanggal}`;
    }

    // Use ApiHelper for retry logic and better error handling
    const result = await window.ApiHelper.request(url, {
      method: "GET"
    });

    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.log("✅ API Response:", result);
    }

    // Handle different response formats
    if (result.success !== undefined) {
      return result.data || [];
    } else if (Array.isArray(result)) {
      return result;
    } else {
      if (window.APP_CONFIG?.DEBUG) {
        APP_LOGGER.warn("⚠️ Unknown response format:", result);
      }
      return [];
    }
  } catch (error) {
    if (window.APP_CONFIG?.DEBUG) {
      APP_LOGGER.error("❌ Error fetching laporan:", error);
    }
    throw error;
  }
}

// Fungsi render tabel dengan virtual scrolling untuk large datasets
function renderTabel(data) {
  const tbody = document.querySelector("#tabelLaporan tbody");
  const totalDisplay = getElement('totalLaporan');

  // Clear existing data
  tbody.innerHTML = "";

  // Handle empty data
  if (!data || data.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="4" class="py-4 px-4 text-center text-gray-500">
        <i class="fas fa-inbox mr-2"></i>Tidak ada data laporan
      </td>
    `;
    tbody.appendChild(emptyRow);
    totalDisplay.textContent = "Rp 0";
    return;
  }

  let total = 0;
  let html = '';

  // Build HTML string untuk performance (batch DOM updates)
  data.forEach((item, index) => {
    total += parseInt(item.nominal) || 0;
    html += `
      <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
        <td class="py-3 px-4 border-b border-gray-200">${formatTanggal(
          item.tanggal_input
        )}</td>
        <td class="py-3 px-4 border-b border-gray-200">${
          item.nama_donatur || "-"
        }</td>
        <td class="py-3 px-4 border-b border-gray-200">${
          item.kategori_rt || "Semua"
        }</td>
        <td class="py-3 px-4 border-b border-gray-200 text-right font-mono">${formatRupiah(
          item.nominal
        )}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Update total
  totalDisplay.textContent = formatRupiah(total);
  
  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("📈 Total calculated:", total);
  }
}

// Helper function untuk format tanggal
function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  try {
    const date = new Date(tanggal);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (error) {
    return tanggal;
  }
}

// Helper function untuk format Rupiah
function formatRupiah(nominal) {
  if (!nominal) return "Rp 0";
  return "Rp " + Number(nominal).toLocaleString("id-ID");
}

// Helper function untuk format tanggal display
function formatTanggalDisplay(tanggalString) {
  if (!tanggalString) return "";

  const date = new Date(tanggalString);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message, type = "info") {
  // Hapus notifikasi existing
  const existingNotif = document.getElementById("customNotification");
  if (existingNotif) {
    existingNotif.remove();
  }

  // Buat notifikasi baru
  const notif = document.createElement("div");
  notif.id = "customNotification";

  const bgColor =
    type === true
      ? "bg-green-100 border-green-400 text-green-700"
      : type === false
      ? "bg-red-100 border-red-400 text-red-700"
      : "bg-blue-100 border-blue-400 text-blue-700";

  notif.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg border-2 shadow-lg transition-all duration-300 transform translate-x-0 ${bgColor}`;
  notif.innerHTML = `
    <div class="flex items-center">
      <i class="fas ${
        type === true
          ? "fa-check-circle"
          : type === false
          ? "fa-exclamation-circle"
          : "fa-info-circle"
      } mr-3"></i>
      <span class="font-semibold">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-gray-500 hover:text-gray-700">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  document.body.appendChild(notif);

  // Auto remove setelah 5 detik
  setTimeout(() => {
    if (notif.parentElement) {
      notif.style.transform = "translateX(100%)";
      setTimeout(() => notif.remove(), 300);
    }
  }, 5000);
}

// Fungsi untuk show/hide loading state
function showLoadingState(show) {
  const btnGenerate = getElement('btnGenerate');
  const btnExportPDF = getElement('btnExportPDF');
  const btnExportExcel = getElement('btnExportExcel');

  if (show) {
    btnGenerate.innerHTML =
      '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
    btnGenerate.disabled = true;
    btnExportPDF.disabled = true;
    btnExportExcel.disabled = true;
  } else {
    btnGenerate.innerHTML =
      '<i class="fas fa-sync-alt mr-2"></i>Generate Laporan';
    btnGenerate.disabled = false;
    btnExportPDF.disabled = false;
    btnExportExcel.disabled = false;
  }
}

// Fungsi untuk update UI state
function updateUIState() {
  const kategori = getElement('filterKategori').value;
  const periode = getElement('filterPeriode').value;
  const tanggal = getElement('filterTanggal').value;

  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("🔄 UI State Updated:", { kategori, periode, tanggal });
  }
}

// Cleanup function
window.addEventListener('beforeunload', () => {
  reportCache.clear();
  domCache.clear();
});

// Export functions untuk global access
window.generateLaporan = generateLaporan;
window.exportLaporan = exportLaporan;

// Debug functions hanya tersedia di development mode
if (window.APP_CONFIG?.DEBUG) {
  window.adminDebug = {
    testConnection: async function () {
      try {
        const response = await window.ApiHelper.request('/health');
        APP_LOGGER.log("🔗 Connection test:", response);
        return response;
      } catch (error) {
        APP_LOGGER.error("❌ Connection test failed:", error);
        return null;
      }
    },

    clearCache: function() {
      reportCache.clear();
      domCache.clear();
      localStorage.removeItem('reportCache');
      showNotification("Cache cleared successfully", true);
    },

    getCacheStats: function() {
      return {
        reportCacheSize: reportCache.size,
        domCacheSize: domCache.size
      };
    }
  };
} else {
  // Remove debug functions in production
  window.adminDebug = undefined;
}
