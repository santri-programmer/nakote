// ======= CONFIGURATION =======
const API_URL = window.APP_CONFIG?.API_URL || "https://api.pnakote.my.id/api";
const APP_LOGGER = window.AppLogger || console;

// Safe API request function dengan fallback
const safeApiRequest = async (endpoint, options = {}) => {
  if (window.ApiHelper && typeof window.ApiHelper.request === 'function') {
    return window.ApiHelper.request(endpoint, options);
  } else if (window.safeApiRequest) {
    return window.safeApiRequest(endpoint, options);
  } else {
    // Fallback ke fetch langsung
    const API_BASE = window.APP_CONFIG?.API_URL || "https://api.pnakote.my.id/api";
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response.json();
  }
};

// Security: Disable console in production for main app too
if (!window.APP_CONFIG?.DEBUG) {
  // Override console methods
  const originalConsole = console;
  console = {
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {}, // Minimal error logging
    trace: () => {},
    table: () => {},
    group: () => {},
    groupEnd: () => {},
    groupCollapsed: () => {},
    clear: () => {}
  };
}

// ======= DATA & INIT =======
const kategoriDonatur = {
  kategori1: [
    "Mas Ani", "Pak Kholis", "Pak Hasyim", "Amat", "Mbak Is", 
    "Dani", "Pak Napi", "Pak Ipin", "Mas Agus BZ", "Pak Fat",
    "Pak Ropi", "Mas Umam", "Pak Kisman", "Pak Yanto", "Pak Pardi",
    "Pak Salam", "Pak Piyan", "Pak Slamet", "Pak Ibin", "Idek",
    "Pak Ngari", "Pak Tukhin", "Pak Rofiq", "Pak Syafak", "Pak Jubaidi",
    "Mbak Kholis", "Pak Kholiq", "Pak Rokhan", "Mas Agus", "Mas Izin",
    "Pak Abror", "Mas Gustaf"
  ],
  kategori2: ["Pak A", "Pak B", "Pak C"],
  kategori3: ["Pak A", "Pak B", "Pak C"],
};

const kategoriLabel = {
  kategori1: "RT Tengah",
  kategori2: "RT Kulon", 
  kategori3: "RT Kidul",
};

const kategoriMapping = {
  kategori1: "RT Tengah",
  kategori2: "RT Kulon",
  kategori3: "RT Kidul",
};

let dataDonasi = [];
let sudahUploadHariIni = {
  kategori1: false,
  kategori2: false,
  kategori3: false,
};

let donaturTerinput = {
  kategori1: new Set(),
  kategori2: new Set(),
  kategori3: new Set(),
};

// PWA Integration
let pwaManager = null;
if (window.jimpitanPWA) {
  pwaManager = window.jimpitanPWA;
}

let cachedElements = {};
let domCache = new Map();
let periodicCheckInterval = null;

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  const startTime = Date.now();
  
  // Safety check - pastikan dependencies sudah loaded
  if (!window.APP_CONFIG) {
    console.error('❌ APP_CONFIG not found. Make sure config.js is loaded first.');
    showNotification('Configuration error. Please refresh the page.', false);
    return;
  }
  
  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("🚀 Initializing Jimpitan PWA...");
    APP_LOGGER.log("🔧 ApiHelper available:", !!window.ApiHelper);
    APP_LOGGER.log("🔧 safeApiRequest available:", !!window.safeApiRequest);
  }
  
  cachedElements = {
    tanggalHariIni: document.getElementById("tanggalHariIni"),
    notifikasi: document.getElementById("notifikasi"),
    kategoriDonatur: document.getElementById("kategoriDonatur"),
    donatur: document.getElementById("donatur"),
    pemasukan: document.getElementById("pemasukan"),
    btnTambah: document.getElementById("btnTambah"),
    btnUpload: document.getElementById("btnUpload"),
    btnHapus: document.getElementById("btnHapus"),
    tabelDonasi: document.getElementById("tabelDonasi"),
    totalDonasi: document.getElementById("totalDonasi"),
    uploadStatus: document.getElementById("uploadStatus"),
    uploadInfo: document.getElementById("uploadInfo"),
  };

  // Initialize UI
  initUI();
  setupEventListeners();
  checkUploadStatus();
  startPeriodicStatusCheck(); // 🔥 Start periodic checking
  
  if (window.APP_CONFIG?.DEBUG) {
    window.AppLogger.performance("App Initialization", startTime);
  }
}

function initUI() {
  const tanggalHariIni = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  cachedElements.tanggalHariIni.innerHTML = `<i class="fas fa-calendar-day mr-2 text-purple-500"></i>${tanggalHariIni}`;
  muatDropdown("kategori1");
}

function setupEventListeners() {
  // Event delegation untuk performance
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btnTambah")) {
      tambahData();
    } else if (e.target.closest("#btnUpload")) {
      handleUpload();
    } else if (e.target.closest("#btnHapus")) {
      hapusData();
    } else if (e.target.closest(".edit-btn")) {
      const row = e.target.closest("tr");
      const donatur = row.cells[0].textContent;
      const kategori = cachedElements.kategoriDonatur.value;
      editRow(row, kategori, donatur);
    } else if (e.target.closest(".delete-btn")) {
      const row = e.target.closest("tr");
      const donatur = row.cells[0].textContent;
      const kategori = cachedElements.kategoriDonatur.value;
      hapusRow(kategori, donatur);
    } else if (e.target.closest(".save-btn")) {
      const row = e.target.closest("tr");
      const donatur = row.cells[0].textContent;
      const kategori = cachedElements.kategoriDonatur.value;
      saveRow(row, kategori, donatur);
    } else if (e.target.closest(".cancel-btn")) {
      const kategori = cachedElements.kategoriDonatur.value;
      renderTabelTerurut(kategori);
    }
  });

  cachedElements.kategoriDonatur.addEventListener("change", function () {
    const kategori = this.value;
    muatDropdown(kategori);
    dataDonasi = [];
    const tbody = cachedElements.tabelDonasi.querySelector("tbody");
    tbody.innerHTML = "";
    updateTotalDisplay();
    checkUploadStatus(); // 🔥 Check status setiap ganti kategori
    updateUploadButtonState();
  });

  cachedElements.pemasukan.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      tambahData();
    }
  });

  // Handle page visibility change - refresh status ketika tab aktif
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      checkUploadStatus();
    }
  });

  // Optimized input handling
  cachedElements.pemasukan.addEventListener(
    "input",
    debounce(() => {
      // Input validation bisa ditambahkan di sini
    }, 300)
  );
}

// debounce function untuk performance
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 🔥 REAL-TIME UPLOAD STATUS CHECKING
async function checkUploadStatus() {
  const kategori = cachedElements.kategoriDonatur.value;
  const kategoriValue = kategoriMapping[kategori];

  try {
    // Check status dari server - REAL TIME
    const response = await safeApiRequest(`/upload-status?kategori=${encodeURIComponent(kategoriValue)}`);
    
    if (response.already_uploaded) {
      sudahUploadHariIni[kategori] = true;
      showUploadStatus(
        `❌ Data ${kategoriLabel[kategori]} hari ini sudah diupload. Upload hanya dapat dilakukan sekali per hari.`,
        false
      );
      
      // Nonaktifkan input jika sudah diupload
      cachedElements.btnTambah.disabled = true;
      cachedElements.pemasukan.disabled = true;
      cachedElements.btnTambah.querySelector("#btnText").textContent = "Terkunci";
      
    } else {
      sudahUploadHariIni[kategori] = false;
      showUploadStatus(
        `✅ Siap untuk upload data ${kategoriLabel[kategori]}`,
        true
      );
      
      // Aktifkan input jika belum diupload
      cachedElements.btnTambah.disabled = false;
      cachedElements.pemasukan.disabled = false;
      cachedElements.btnTambah.querySelector("#btnText").textContent = "Tambah";
    }
    
    if (window.APP_CONFIG?.DEBUG) {
      console.log(`🔍 Upload Status ${kategoriLabel[kategori]}:`, response.already_uploaded);
    }
    
  } catch (error) {
    console.error("Error checking upload status:", error);
    
    // Fallback ke local storage jika server error
    const lastUploadDate = getLastUploadDate();
    const today = new Date().toISOString().split("T")[0];

    if (lastUploadDate[kategori] === today) {
      sudahUploadHariIni[kategori] = true;
      showUploadStatus(
        `❌ Data ${kategoriLabel[kategori]} hari ini sudah diupload (local).`,
        false
      );
    } else {
      sudahUploadHariIni[kategori] = false;
      showUploadStatus(
        `✅ Siap untuk upload data ${kategoriLabel[kategori]}`,
        true
      );
    }
  }

  updateUploadButtonState();
}

// 🔥 PERIODIC STATUS CHECK - Real-time sync across devices
function startPeriodicStatusCheck() {
  // Clear existing interval jika ada
  if (periodicCheckInterval) {
    clearInterval(periodicCheckInterval);
  }
  
  // Check status setiap 30 detik
  periodicCheckInterval = setInterval(() => {
    if (!document.hidden) { // Hanya check jika tab aktif
      checkUploadStatus();
      
      if (window.APP_CONFIG?.DEBUG) {
        console.log("🔄 Periodic status check executed");
      }
    }
  }, 30000); // 30 detik
}

// load donatur ke dropdown dengan caching
function muatDropdown(kategori = "kategori1") {
  const cacheKey = `dropdown-${kategori}`;
  if (domCache.has(cacheKey)) {
    cachedElements.donatur.innerHTML = domCache.get(cacheKey);
    return;
  }

  const select = cachedElements.donatur;
  const names = kategoriDonatur[kategori];

  const donaturBelumDiinput = names.filter(
    (nama) => !donaturTerinput[kategori].has(nama)
  );

  let html = "";

  if (donaturBelumDiinput.length === 0) {
    html = '<option value="" disabled>Semua donatur sudah diinput</option>';
    cachedElements.btnTambah.disabled = true;
    cachedElements.btnTambah.querySelector("#btnText").textContent = "Selesai";
    cachedElements.pemasukan.disabled = true;

    showNotification("✅ Semua donatur sudah diinput");
  } else {
    html = '<option value="">Pilih Donatur</option>';
    html += donaturBelumDiinput
      .map((nama) => `<option value="${nama}">${nama}</option>`)
      .join("");

    select.selectedIndex = 0;

    setTimeout(() => {
      cachedElements.pemasukan.focus();
    }, 100);

    cachedElements.btnTambah.disabled = false;
    cachedElements.btnTambah.querySelector("#btnText").textContent = "Tambah";
    cachedElements.pemasukan.disabled = false;

    const totalDonatur = names.length;
    const sudahDiinput = totalDonatur - donaturBelumDiinput.length;
    if (sudahDiinput > 0) {
      showNotification(
        `📝 ${sudahDiinput} donatur sudah diinput, ${donaturBelumDiinput.length} tersisa`
      );
    }
  }

  select.innerHTML = html;
  domCache.set(cacheKey, html);
  updateUploadButtonState();
}

function updateUploadButtonState() {
  const kategori = cachedElements.kategoriDonatur.value;
  const semuaSudahDiinput = semuaDonaturTerinput(kategori);
  const sudahUpload = sudahUploadHariIni[kategori];
  const adaData = dataDonasi.length > 0;

  const shouldEnable = (semuaSudahDiinput || adaData) && !sudahUpload;

  cachedElements.btnUpload.disabled = !shouldEnable;

  if (shouldEnable) {
    cachedElements.btnUpload.classList.remove("upload-disabled", "bg-gray-400", "cursor-not-allowed");
    cachedElements.btnUpload.classList.add("bg-green-600", "hover:bg-green-700", "cursor-pointer");
    cachedElements.btnUpload.title = "Upload data ke server";
  } else {
    cachedElements.btnUpload.classList.add("upload-disabled", "bg-gray-400", "cursor-not-allowed");
    cachedElements.btnUpload.classList.remove("bg-green-600", "hover:bg-green-700", "cursor-pointer");
    
    if (sudahUpload) {
      cachedElements.btnUpload.title = "Data sudah diupload hari ini";
    } else if (!semuaSudahDiinput && !adaData) {
      cachedElements.btnUpload.title = "Tambah data terlebih dahulu";
    } else {
      cachedElements.btnUpload.title = "Upload data ke server";
    }
  }

  // Update info text
  if (sudahUpload) {
    cachedElements.uploadInfo.textContent = `❌ Data ${kategoriLabel[kategori]} sudah diupload hari ini. Upload hanya dapat dilakukan sekali per hari.`;
    cachedElements.uploadInfo.className = "text-red-600 text-sm text-center";
  } else if (!semuaSudahDiinput && !adaData) {
    const totalDonatur = kategoriDonatur[kategori].length;
    const sudahDiinput = donaturTerinput[kategori].size;
    const sisa = totalDonatur - sudahDiinput;
    cachedElements.uploadInfo.textContent = `📝 ${sisa} donatur belum diinput. Upload akan aktif setelah semua donatur diinput atau ada data.`;
    cachedElements.uploadInfo.className = "text-amber-600 text-sm text-center";
  } else if (!adaData) {
    cachedElements.uploadInfo.textContent = "📝 Tidak ada data untuk diupload. Tambah data terlebih dahulu.";
    cachedElements.uploadInfo.className = "text-amber-600 text-sm text-center";
  } else {
    cachedElements.uploadInfo.textContent = `✅ Data siap untuk diupload. ${dataDonasi.length} data akan dikirim ke server.`;
    cachedElements.uploadInfo.className = "text-green-600 text-sm text-center";
  }
}

function semuaDonaturTerinput(kategori) {
  const totalDonatur = kategoriDonatur[kategori].length;
  const sudahDiinput = donaturTerinput[kategori].size;
  return totalDonatur === sudahDiinput;
}

function tambahData() {
  // 🔥 Cek status upload dulu sebelum tambah data
  if (sudahUploadHariIni[cachedElements.kategoriDonatur.value]) {
    showNotification("❌ Data sudah diupload hari ini. Tidak dapat menambah data.", false);
    return;
  }

  const donatur = cachedElements.donatur.value;
  const nominal = cachedElements.pemasukan.value;
  const kategori = cachedElements.kategoriDonatur.value;

  if (!donatur || donatur === "" || !nominal) {
    showNotification("Nama dan nominal tidak boleh kosong", false);
    return;
  }

  if (nominal <= 0) {
    showNotification("Nominal harus lebih dari 0", false);
    return;
  }

  const tanggal = new Date().toLocaleDateString("id-ID");

  const existingIndex = dataDonasi.findIndex(
    (item) => item.donatur === donatur
  );
  if (existingIndex !== -1) {
    dataDonasi[existingIndex].nominal = nominal;
    dataDonasi[existingIndex].tanggal = tanggal;
    showNotification(`✅ ${donatur} berhasil diupdate`);
  } else {
    dataDonasi.push({ donatur, nominal, tanggal });
    donaturTerinput[kategori].add(donatur);
    showNotification(`✅ ${donatur} berhasil ditambahkan`);
  }

  renderTabelTerurut(kategori);
  muatDropdown(kategori);

  cachedElements.pemasukan.value = "";
  updateTotalDisplay();
  updateUploadButtonState();

  setTimeout(() => {
    cachedElements.pemasukan.focus();
  }, 100);
}

function renderTabelTerurut(kategori) {
  const tbody = cachedElements.tabelDonasi.querySelector("tbody");

  // Clear cache
  domCache.delete(`dropdown-${kategori}`);

  const dataMap = new Map();
  dataDonasi.forEach((item) => dataMap.set(item.donatur, item));

  const sortedData = [];
  kategoriDonatur[kategori].forEach((nama) => {
    if (dataMap.has(nama)) {
      sortedData.push(dataMap.get(nama));
    }
  });

  // Build HTML string untuk performance
  let html = "";
  sortedData.forEach((item, index) => {
    const isLocked = sudahUploadHariIni[kategori];
    
    html += `
      <tr class="table-row ${isLocked ? 'opacity-60' : ''}">
        <td class="py-3 md:py-4 px-4 md:px-6">${item.donatur}</td>
        <td class="py-3 md:py-4 px-4 md:px-6 text-right font-mono">Rp ${Number(
          item.nominal
        ).toLocaleString("id-ID")}</td>
        <td class="py-3 md:py-4 px-4 md:px-6 text-center">
          <button class="edit-btn bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg transition duration-200 mx-1 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}" 
                  title="${isLocked ? 'Data terkunci - sudah diupload' : 'Edit donasi'}" 
                  ${isLocked ? 'disabled' : ''}>
            <i class="fas fa-edit"></i>
          </button>
          <button class="delete-btn bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition duration-200 mx-1 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}" 
                  title="${isLocked ? 'Data terkunci - sudah diupload' : 'Hapus donasi'}" 
                  ${isLocked ? 'disabled' : ''}>
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updateTotalDisplay();
}

function updateTotalDisplay() {
  let total = 0;
  const rows = cachedElements.tabelDonasi.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const text = row.cells[1].textContent.replace(/[Rp\s.]/g, "");
    total += Number(text);
  });

  cachedElements.totalDonasi.textContent =
    "Rp " + total.toLocaleString("id-ID");
}

function editRow(row, kategori, donaturLama) {
  // 🔥 Cek status upload sebelum edit
  if (sudahUploadHariIni[kategori]) {
    showNotification("❌ Data sudah diupload. Tidak dapat mengedit.", false);
    return;
  }

  const nominalCell = row.cells[1];
  const aksiCell = row.cells[2];
  const currentNominal = nominalCell.textContent.replace(/[Rp\s.]/g, "");

  nominalCell.innerHTML = `<input type="number" id="editInput" value="${currentNominal}" min="0" 
     class="w-24 md:w-32 px-3 py-2 border border-gray-300 rounded text-right font-mono 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`;

  aksiCell.innerHTML = `
    <button class="save-btn bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg mx-1 transition duration-200">
      <i class="fas fa-check"></i>
    </button>
    <button class="cancel-btn bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg mx-1 transition duration-200">
      <i class="fas fa-times"></i>
    </button>
  `;

  setTimeout(() => {
    const editInput = document.getElementById("editInput");
    if (editInput) {
      editInput.focus();
      editInput.select();
    }
  }, 100);
}

function saveRow(row, kategori, donaturLama) {
  const newValue = document.getElementById("editInput").value;
  if (newValue === "" || newValue <= 0) {
    showNotification(
      "Nominal tidak boleh kosong dan harus lebih dari 0",
      false
    );
    return;
  }

  const index = dataDonasi.findIndex((item) => item.donatur === donaturLama);
  if (index !== -1) {
    dataDonasi[index].nominal = newValue;
  }

  renderTabelTerurut(kategori);
  updateTotalDisplay();
  showNotification(`✅ Donasi ${donaturLama} berhasil diperbarui`);
  updateUploadButtonState();
}

function hapusRow(kategori, donatur) {
  // 🔥 Cek status upload sebelum hapus
  if (sudahUploadHariIni[kategori]) {
    showNotification("❌ Data sudah diupload. Tidak dapat menghapus.", false);
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus donasi dari ${donatur}?`)) {
    return;
  }

  const index = dataDonasi.findIndex((item) => item.donatur === donatur);
  if (index !== -1) {
    dataDonasi.splice(index, 1);
    donaturTerinput[kategori].delete(donatur);
  }

  renderTabelTerurut(kategori);
  muatDropdown(kategori);
  updateTotalDisplay();
  showNotification(`✅ Donasi ${donatur} berhasil dihapus`);
  updateUploadButtonState();
}

function hapusData() {
  const kategori = cachedElements.kategoriDonatur.value;

  // 🔥 Cek status upload sebelum hapus semua
  if (sudahUploadHariIni[kategori]) {
    showNotification("❌ Data sudah diupload. Tidak dapat menghapus data.", false);
    return;
  }

  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk dihapus", false);
    return;
  }

  if (
    !confirm(
      `Apakah Anda yakin ingin menghapus semua data untuk ${kategoriLabel[kategori]}?`
    )
  ) {
    return;
  }

  dataDonasi = [];
  donaturTerinput[kategori].clear();
  muatDropdown(kategori);
  renderTabelTerurut(kategori);
  updateTotalDisplay();
  showNotification(
    `✅ Semua data untuk ${kategoriLabel[kategori]} berhasil dihapus`
  );
  updateUploadButtonState();
}

function getLastUploadDate() {
  const raw = localStorage.getItem("lastUploadDate");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Show notification pesan dengan animation
function showNotification(message, isSuccess = true) {
  const notif = cachedElements.notifikasi;
  notif.textContent = message;
  notif.className =
    "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300 opacity-100 show";

  if (isSuccess) {
    notif.classList.add("bg-green-50", "border-green-200", "text-green-700");
  } else {
    notif.classList.add("bg-red-50", "border-red-200", "text-red-700");
  }

  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => {
      notif.textContent = "";
      notif.className =
        "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300";
    }, 300);
  }, 3000);
}

// Upload status
function showUploadStatus(message, isSuccess = null) {
  const status = cachedElements.uploadStatus;
  status.textContent = message;
  status.className =
    "text-center p-4 rounded-xl transition-all duration-300 opacity-100 show";

  if (isSuccess === true) {
    status.classList.add("bg-green-50", "border-green-200", "text-green-700");
  } else if (isSuccess === false) {
    status.classList.add("bg-red-50", "border-red-200", "text-red-700");
  } else {
    status.classList.add("bg-blue-50", "border-blue-200", "text-blue-700");
  }
}

// 🔥 MAIN UPLOAD HANDLER dengan real-time lock checking
async function handleUpload() {
  const kategoriKey = cachedElements.kategoriDonatur.value;
  const kategoriValue = kategoriMapping[kategoriKey];

  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk diupload", false);
    return;
  }

  // 🔥 DOUBLE CHECK dari server sebelum upload
  try {
    const statusCheck = await safeApiRequest(`/upload-status?kategori=${encodeURIComponent(kategoriValue)}`);
    if (statusCheck.already_uploaded) {
      showUploadStatus(
        `❌ Data ${kategoriLabel[kategoriKey]} sudah diupload oleh perangkat lain.`,
        false
      );
      sudahUploadHariIni[kategoriKey] = true;
      updateUploadButtonState();
      
      // Nonaktifkan input
      cachedElements.btnTambah.disabled = true;
      cachedElements.pemasukan.disabled = true;
      return;
    }
  } catch (error) {
    console.error("Pre-upload status check failed:", error);
    // Lanjutkan upload meskipun check gagal
  }

  try {
    // Show loading state
    showUploadStatus("🔄 Mengupload data ke server...", "info");
    cachedElements.btnUpload.disabled = true;
    cachedElements.btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    let successCount = 0;
    let errorCount = 0;
    let errorMessages = [];

    for (const item of dataDonasi) {
      try {
        const payload = {
          nama_donatur: item.donatur,
          kategori_rt: kategoriValue,
          nominal: Number(item.nominal),
          tanggal_input: new Date().toISOString(),
        };

        if (window.APP_CONFIG?.DEBUG) {
          console.log("📤 Upload payload:", payload);
        }

        const result = await safeApiRequest('/donasi', {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (result) {
          successCount++;
          if (window.APP_CONFIG?.DEBUG) {
            console.log(`✅ Upload success for ${item.donatur}`);
          }
        } else {
          errorCount++;
          errorMessages.push(`${item.donatur}: No response from server`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (itemError) {
        console.error(`❌ Error uploading ${item.donatur}:`, itemError);
        
        // 🔥 Handle kategori already uploaded error
        if (itemError.message.includes('KATEGORI_ALREADY_UPLOADED') || 
            itemError.message.includes('kategori sudah diupload') ||
            itemError.message.includes('already uploaded')) {
          
          showUploadStatus(
            `❌ Upload dibatalkan: ${kategoriLabel[kategoriKey]} sudah diupload oleh perangkat lain.`,
            false
          );
          sudahUploadHariIni[kategoriKey] = true;
          updateUploadButtonState();
          
          // Nonaktifkan input
          cachedElements.btnTambah.disabled = true;
          cachedElements.pemasukan.disabled = true;
          return;
        }
        
        errorCount++;
        errorMessages.push(`${item.donatur}: ${itemError.message}`);
      }
    }

    // Handle results
    if (errorCount === 0) {
      // All successful
      sudahUploadHariIni[kategoriKey] = true;
      
      // Update local storage
      let lastUploadDate = getLastUploadDate();
      lastUploadDate[kategoriKey] = new Date().toISOString().split("T")[0];
      localStorage.setItem("lastUploadDate", JSON.stringify(lastUploadDate));

      showUploadStatus(
        `✅ Semua data (${successCount} items) berhasil diupload untuk ${kategoriLabel[kategoriKey]}`,
        true
      );

      // Clear data
      dataDonasi = [];
      donaturTerinput[kategoriKey].clear();
      muatDropdown(kategoriKey);
      renderTabelTerurut(kategoriKey);
      updateTotalDisplay();
      
      // Nonaktifkan input setelah upload sukses
      cachedElements.btnTambah.disabled = true;
      cachedElements.pemasukan.disabled = true;
      cachedElements.btnTambah.querySelector("#btnText").textContent = "Terkunci";
      
    } else if (successCount > 0) {
      // Partial success
      const errorSummary = errorMessages.slice(0, 3).join(', ');
      const moreErrors = errorMessages.length > 3 ? ` dan ${errorMessages.length - 3} error lainnya` : '';
      
      showUploadStatus(
        `⚠️ ${successCount} data berhasil, ${errorCount} gagal. Error: ${errorSummary}${moreErrors}`,
        false
      );
    } else {
      // All failed
      const errorSummary = errorMessages.slice(0, 3).join(', ');
      throw new Error(`Semua upload gagal: ${errorSummary}`);
    }

  } catch (err) {
    console.error("❌ Upload error:", err);
    
    let errorMessage = err.message;
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
    } else if (err.message.includes('Network Error')) {
      errorMessage = "Koneksi jaringan terputus. Periksa koneksi internet Anda.";
    } else if (err.message.includes('KATEGORI_ALREADY_UPLOADED')) {
      errorMessage = `Data ${kategoriLabel[kategoriKey]} sudah diupload oleh perangkat lain.`;
      sudahUploadHariIni[kategoriKey] = true;
    }
    
    showUploadStatus(`❌ ${errorMessage}`, false);
  } finally {
    updateUploadButtonState();
    cachedElements.btnUpload.disabled = false;
    cachedElements.btnUpload.innerHTML = '<i class="fas fa-upload"></i> Upload Data';
    
    // 🔥 Refresh status dari server setelah upload attempt
    setTimeout(() => checkUploadStatus(), 2000);
  }
}

// Handle offline upload
async function handleOfflineUpload(kategoriValue) {
  const confirmOffline = confirm(
    "Anda sedang offline. Data akan disimpan secara lokal dan diupload otomatis saat online. Lanjutkan?"
  );

  if (!confirmOffline) return false;

  try {
    showUploadStatus("💾 Menyimpan data secara offline...", "info");

    // Check if PWA manager is available
    if (!pwaManager || !pwaManager.saveForOfflineSync) {
      throw new Error("Fitur offline tidak tersedia. Pastikan aplikasi terinstall dengan benar.");
    }

    for (const item of dataDonasi) {
      const payload = {
        nama_donatur: item.donatur,
        kategori_rt: kategoriValue,
        nominal: Number(item.nominal),
        tanggal_input: new Date().toISOString(),
        endpoint: '/donasi',
        method: 'POST'
      };

      const saved = await pwaManager.saveForOfflineSync("donasi", payload);
      if (!saved) {
        throw new Error("Gagal menyimpan data offline");
      }
    }

    showUploadStatus(
      `✅ Data disimpan offline (${dataDonasi.length} items). Akan diupload otomatis saat online.`,
      true
    );

    // Clear data setelah berhasil disimpan offline
    dataDonasi = [];
    donaturTerinput[cachedElements.kategoriDonatur.value].clear();
    renderTabelTerurut(cachedElements.kategoriDonatur.value);
    updateTotalDisplay();
    updateUploadButtonState();

    return true;
  } catch (error) {
    showUploadStatus(`❌ Gagal menyimpan offline: ${error.message}`, false);
    return false;
  }
}

// 🔥 Reset data setiap hari baru
function checkDayChange() {
  const today = new Date().toISOString().split("T")[0];
  const lastCheck = localStorage.getItem("lastDayCheck");
  
  if (lastCheck !== today) {
    // Hari baru - reset semua status
    localStorage.setItem("lastDayCheck", today);
    
    // Reset local upload status
    localStorage.removeItem("lastUploadDate");
    
    // Reset UI state
    Object.keys(sudahUploadHariIni).forEach(kategori => {
      sudahUploadHariIni[kategori] = false;
    });
    
    // Refresh status dari server
    checkUploadStatus();
    
    if (window.APP_CONFIG?.DEBUG) {
      console.log("🔄 Day change detected - resetting upload status");
    }
  }
}

// Initialize day change checker
setInterval(checkDayChange, 60000); // Check every minute
checkDayChange(); // Check on load

// Cleanup function untuk mencegah memory leaks
window.addEventListener("beforeunload", () => {
  if (periodicCheckInterval) {
    clearInterval(periodicCheckInterval);
  }
  domCache.clear();
  dataDonasi = null;
  donaturTerinput = null;
});

// Export functions untuk testing (jika diperlukan)
if (window.APP_CONFIG?.DEBUG) {
  window.jimpitanApp = {
    checkUploadStatus,
    updateUploadButtonState,
    getUploadStatus: () => sudahUploadHariIni,
    getDataDonasi: () => dataDonasi,
    resetApp: () => {
      dataDonasi = [];
      Object.keys(donaturTerinput).forEach(k => donaturTerinput[k].clear());
      Object.keys(sudahUploadHariIni).forEach(k => sudahUploadHariIni[k] = false);
      localStorage.removeItem("lastUploadDate");
      checkUploadStatus();
    }
  };
}
