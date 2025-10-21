// ======= CONFIGURATION =======
const API_URL = window.APP_CONFIG?.API_URL || "https://api.pnakote.my.id/api";
const APP_LOGGER = window.AppLogger || console;

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

document.addEventListener("DOMContentLoaded", () => {
  if (window.APP_CONFIG?.DEBUG) {
    APP_LOGGER.log("🚀 Initializing Jimpitan PWA...");
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
  updateUploadButtonState();
});

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
  cachedElements.btnTambah.addEventListener("click", tambahData);
  cachedElements.btnUpload.addEventListener("click", handleUpload);
  cachedElements.btnHapus.addEventListener("click", hapusData);

  cachedElements.kategoriDonatur.addEventListener("change", function () {
    const kategori = this.value;
    muatDropdown(kategori);
    dataDonasi = [];
    const tbody = cachedElements.tabelDonasi.querySelector("tbody");
    tbody.innerHTML = "";
    updateTotalDisplay();
    checkUploadStatus();
    updateUploadButtonState();
  });

  cachedElements.pemasukan.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      tambahData();
    }
  });

  cachedElements.pemasukan.addEventListener(
    "input",
    debounce(() => {}, 300)
  );
}

// debounce function
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// load donatur ke dropdown
function muatDropdown(kategori = "kategori1") {
  const select = cachedElements.donatur;
  const names = kategoriDonatur[kategori];

  const donaturBelumDiinput = names.filter(
    (nama) => !donaturTerinput[kategori].has(nama)
  );

  select.innerHTML = "";

  if (donaturBelumDiinput.length === 0) {
    const option = new Option("Semua donatur sudah diinput", "");
    option.disabled = true;
    select.appendChild(option);

    cachedElements.btnTambah.disabled = true;
    cachedElements.btnTambah.querySelector("#btnText").textContent = "Selesai";
    cachedElements.pemasukan.disabled = true;

    showNotification("✅ Semua donatur sudah diinput");
  } else {
    donaturBelumDiinput.forEach((nama) => {
      const option = new Option(nama, nama);
      select.appendChild(option);
    });

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

  updateUploadButtonState();
}

// Check upload status
function checkUploadStatus() {
  const lastUploadDate = getLastUploadDate();
  const today = new Date().toISOString().split("T")[0];
  const kategori = cachedElements.kategoriDonatur.value;

  if (lastUploadDate[kategori] === today) {
    sudahUploadHariIni[kategori] = true;
    showUploadStatus(
      `Anda sudah melakukan upload hari ini untuk ${kategoriLabel[kategori]}. Upload hanya dapat dilakukan sekali per hari.`,
      false
    );
  } else {
    sudahUploadHariIni[kategori] = false;
    showUploadStatus(
      `Siap untuk upload data kategori ${kategoriLabel[kategori]}`,
      null
    );
  }

  updateUploadButtonState();
}

function updateUploadButtonState() {
  const kategori = cachedElements.kategoriDonatur.value;
  const semuaSudahDiinput = semuaDonaturTerinput(kategori);
  const sudahUpload = sudahUploadHariIni[kategori];
  const adaData = dataDonasi.length > 0;

  const shouldEnable = (semuaSudahDiinput || adaData) && !sudahUpload && adaData;

  cachedElements.btnUpload.disabled = !shouldEnable;

  if (shouldEnable) {
    cachedElements.btnUpload.classList.remove("upload-disabled", "bg-gray-400");
    cachedElements.btnUpload.classList.add("bg-green-600", "hover:bg-green-700");
  } else {
    cachedElements.btnUpload.classList.add("upload-disabled", "bg-gray-400");
    cachedElements.btnUpload.classList.remove("bg-green-600", "hover:bg-green-700");
  }

  if (sudahUpload) {
    cachedElements.uploadInfo.textContent = `Anda sudah melakukan upload hari ini untuk ${kategoriLabel[kategori]}. Upload hanya dapat dilakukan sekali per hari.`;
  } else if (!semuaSudahDiinput) {
    const totalDonatur = kategoriDonatur[kategori].length;
    const sudahDiinput = donaturTerinput[kategori].size;
    const sisa = totalDonatur - sudahDiinput;
    cachedElements.uploadInfo.textContent = `${sisa} donatur belum diinput. Upload akan aktif setelah semua donatur diinput.`;
  } else if (!adaData) {
    cachedElements.uploadInfo.textContent = "Tidak ada data untuk diupload.";
  }
}

function semuaDonaturTerinput(kategori) {
  const totalDonatur = kategoriDonatur[kategori].length;
  const sudahDiinput = donaturTerinput[kategori].size;
  return totalDonatur === sudahDiinput;
}

function tambahData() {
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
  tbody.innerHTML = "";

  const dataMap = new Map();
  dataDonasi.forEach((item) => dataMap.set(item.donatur, item));

  const sortedData = [];
  kategoriDonatur[kategori].forEach((nama) => {
    if (dataMap.has(nama)) {
      sortedData.push(dataMap.get(nama));
    }
  });

  sortedData.forEach((item) => {
    const row = tbody.insertRow();
    row.className = "table-row";

    const donaturCell = row.insertCell(0);
    donaturCell.className = "py-3 md:py-4 px-4 md:px-6";
    donaturCell.textContent = item.donatur;

    const nominalCell = row.insertCell(1);
    nominalCell.className = "py-3 md:py-4 px-4 md:px-6 text-right font-mono";
    nominalCell.textContent = "Rp " + Number(item.nominal).toLocaleString("id-ID");

    const aksiCell = row.insertCell(2);
    aksiCell.className = "py-3 md:py-4 px-4 md:px-6 text-center";

    const editBtn = document.createElement("button");
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.className = "bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg transition duration-200 mx-1";
    editBtn.title = "Edit donasi";
    editBtn.addEventListener("click", () => editRow(row, kategori, item.donatur));
    aksiCell.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.className = "bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition duration-200 mx-1";
    deleteBtn.title = "Hapus donasi";
    deleteBtn.addEventListener("click", () => hapusRow(kategori, item.donatur));
    aksiCell.appendChild(deleteBtn);
  });
}

function updateTotalDisplay() {
  let total = 0;
  const rows = cachedElements.tabelDonasi.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const text = row.cells[1].textContent.replace(/[Rp\s.]/g, "");
    total += Number(text);
  });

  cachedElements.totalDonasi.textContent = "Rp " + total.toLocaleString("id-ID");
}

function editRow(row, kategori, donaturLama) {
  const nominalCell = row.cells[1];
  const aksiCell = row.cells[2];
  const currentNominal = nominalCell.textContent.replace(/[Rp\s.]/g, "");

  nominalCell.innerHTML = `<input type="number" id="editInput" value="${currentNominal}" min="0" 
     class="w-24 md:w-32 px-3 py-2 border border-gray-300 rounded text-right font-mono 
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`;

  aksiCell.innerHTML = "";

  const saveBtn = document.createElement("button");
  saveBtn.innerHTML = '<i class="fas fa-check"></i>';
  saveBtn.className = "bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg mx-1 transition duration-200";
  saveBtn.addEventListener("click", () => saveRow(row, kategori, donaturLama));
  aksiCell.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
  cancelBtn.className = "bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg mx-1 transition duration-200";
  cancelBtn.addEventListener("click", () => renderTabelTerurut(kategori));
  aksiCell.appendChild(cancelBtn);

  setTimeout(() => {
    const editInput = document.getElementById("editInput");
    if (editInput) editInput.focus();
  }, 100);
}

function saveRow(row, kategori, donaturLama) {
  const newValue = document.getElementById("editInput").value;
  if (newValue === "" || newValue <= 0) {
    showNotification("Nominal tidak boleh kosong dan harus lebih dari 0", false);
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
  
  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk dihapus", false);
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus semua data untuk ${kategoriLabel[kategori]}?`)) {
    return;
  }

  dataDonasi = [];
  donaturTerinput[kategori].clear();
  muatDropdown(kategori);
  renderTabelTerurut(kategori);
  updateTotalDisplay();
  showNotification(`✅ Semua data untuk ${kategoriLabel[kategori]} berhasil dihapus`);
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

// Show notification pesan
function showNotification(message, isSuccess = true) {
  const notif = cachedElements.notifikasi;
  notif.textContent = message;
  notif.className = "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300 opacity-100 show";

  if (isSuccess) {
    notif.classList.add("bg-green-50", "border-green-200", "text-green-700");
  } else {
    notif.classList.add("bg-red-50", "border-red-200", "text-red-700");
  }

  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => {
      notif.textContent = "";
      notif.className = "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300";
    }, 300);
  }, 3000);
}

// Upload status
function showUploadStatus(message, isSuccess = null) {
  const status = cachedElements.uploadStatus;
  status.textContent = message;
  status.className = "text-center p-4 rounded-xl transition-all duration-300 opacity-100 show";

  if (isSuccess === true) {
    status.classList.add("bg-green-50", "border-green-200", "text-green-700");
  } else if (isSuccess === false) {
    status.classList.add("bg-red-50", "border-red-200", "text-red-700");
  } else {
    status.classList.add("bg-blue-50", "border-blue-200", "text-blue-700");
  }
}

// Fungsi upload data ke backend MySQL
const kategoriMapping = {
  kategori1: "RT Tengah",
  kategori2: "RT Kulon",
  kategori3: "RT Kidul",
};

// Main upload handler
async function handleUpload() {
  const kategoriKey = cachedElements.kategoriDonatur.value;
  const kategoriValue = kategoriMapping[kategoriKey];

  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk diupload", false);
    return;
  }

  // Check if offline
  if (pwaManager && !pwaManager.isOnline) {
    const success = await handleOfflineUpload(kategoriValue);
    if (success) return;
  }

  try {
    // Show loading state
    showUploadStatus("🔄 Mengupload data ke server...", "info");
    cachedElements.btnUpload.disabled = true;
    cachedElements.btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    let successCount = 0;
    let errorCount = 0;

    for (const item of dataDonasi) {
      try {
        const payload = {
          nama_donatur: item.donatur,
          kategori_rt: kategoriValue,
          nominal: Number(item.nominal),
          tanggal_input: new Date().toISOString(),
        };

        if (window.APP_CONFIG?.DEBUG) {
          APP_LOGGER.log("📤 Upload payload:", payload);
        }

        const res = await fetch(`${API_URL}/donasi`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          successCount++;
        } else {
          const errData = await res.json();
          APP_LOGGER.error(`❌ Upload failed for ${item.donatur}:`, errData);
          errorCount++;
          
          if (res.status === 400) {
            throw new Error(`Data tidak valid: ${errData.error}`);
          } else if (res.status === 500) {
            throw new Error(`Server error: ${errData.error}`);
          } else {
            throw new Error(`Upload gagal: ${errData.error || 'Unknown error'}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (itemError) {
        APP_LOGGER.error(`❌ Error uploading ${item.donatur}:`, itemError);
        errorCount++;
      }
    }

    // Handle results
    if (errorCount === 0) {
      // All successful
      sudahUploadHariIni[kategoriKey] = true;
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
      
    } else if (successCount > 0) {
      // Partial success
      showUploadStatus(
        `⚠️ ${successCount} data berhasil, ${errorCount} gagal diupload. Silakan coba lagi.`,
        false
      );
    } else {
      // All failed
      throw new Error(`Semua upload gagal (${errorCount} items)`);
    }

  } catch (err) {
    APP_LOGGER.error("❌ Upload error:", err);
    
    // Enhanced error handling
    let errorMessage = err.message;
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
    }
    
    showUploadStatus(`❌ ${errorMessage}`, false);
  } finally {
    updateUploadButtonState();
    cachedElements.btnUpload.disabled = false;
    cachedElements.btnUpload.innerHTML = '<i class="fas fa-upload"></i> Upload Data';
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

    for (const item of dataDonasi) {
      const payload = {
        nama_donatur: item.donatur,
        kategori_rt: kategoriValue,
        nominal: Number(item.nominal),
        tanggal_input: new Date().toISOString(),
      };

      // Save for offline sync
      const saved = await pwaManager.saveForOfflineSync("donasi", payload);
      if (!saved) {
        throw new Error("Gagal menyimpan data offline");
      }
    }

    showUploadStatus(
      `✅ Data disimpan offline (${dataDonasi.length} items). Akan diupload otomatis saat online.`,
      true
    );

    updateUploadButtonState();

    return true;
  } catch (error) {
    showUploadStatus(`❌ Gagal menyimpan offline: ${error.message}`, false);
    return false;
  }
}
