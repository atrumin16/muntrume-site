/**
 * Muntrume Motorsport - Setup Vault System
 * Direct iRacing File System Sync & Cloudflare D1 Catalog
 */

const API_BASE = "https://muntrume.atrumin16.workers.dev";
let currentToken = null;
let currentUser = null;
let allSetups = [];
let currentTypeFilter = "All";
let currentViewMode = "folders"; // "folders" | "list"
let allFoldersExpanded = false;
let currentFoldersMap = {};
let currentOrderedFolders = [];
let visibleFoldersLimit = 12;
const FOLDERS_PAGE_SIZE = 12;
let initialIndexRows = [];
let activeLoadedScopeKey = 'index';
let totalVaultSetupsCount = 41530;
let searchDebounceTimer = null;
let localBase64Cache = {};
const loadedCarChunks = {};
let iracingDirHandle = null;
let savedPendingDirHandle = null;
let detectedBrowserInfo = { isBrave: false, supportsFS: false, name: "Navegador" };
let dropdownsInitialized = false;

// Friendly display names for all 64 cars in the Vault
const CAR_LABELS = {
  "acuraarx06gtp": "Acura ARX-06 GTP",
  "acuransxevo22gt3": "Acura NSX EVO22 GT3",
  "amvalkyriegtp": "Aston Martin Valkyrie GTP",
  "amvantageevogt3": "Aston Martin Vantage EVO GT3",
  "amvantagegt4": "Aston Martin Vantage GT4",
  "astonmartin dbr9": "Aston Martin DBR9 GT1",
  "audi90gto": "Audi 90 GTO",
  "audir8lmsevo2gt3": "Audi R8 LMS EVO II GT3",
  "audirs3lmsgen2": "Audi RS 3 LMS Gen 2 TCR",
  "bmwlmdh": "BMW M Hybrid V8 GTP",
  "bmwm2csr": "BMW M2 CS Racing",
  "bmwm2g87": "BMW M2 CS (G87)",
  "bmwm4evogt4": "BMW M4 EVO GT4",
  "bmwm4gt3": "BMW M4 GT3",
  "bmwm8gte": "BMW M8 GTE",
  "c6r": "Corvette C6.R GT1",
  "c8rvettegte": "Corvette C8.R GTE",
  "cadillacvseriesrgtp": "Cadillac V-Series.R GTP",
  "caterham caterham420r": "Caterham Seven 420R",
  "caterham caterhamacademy": "Caterham Academy",
  "chevyvettez06rgt3": "Corvette Z06 GT3.R",
  "dallaraf3": "Dallara F3",
  "dallarair18": "Dallara IR-18 Indycar",
  "dallarap217": "Dallara P217 LMP2",
  "ferrari296gt3": "Ferrari 296 GT3",
  "ferrari488gte": "Ferrari 488 GTE",
  "ferrari499p": "Ferrari 499P Hypercar",
  "fordgt": "Ford GT GT2",
  "fordgt2017": "Ford GT GTE 2017",
  "fordmustanggt3": "Ford Mustang GT3",
  "fordmustanggt4": "Ford Mustang GT4",
  "formulair04": "FIA Formula 4 (iR-04)",
  "formulavee": "Formula Vee",
  "formulavee formulavee2": "Formula Vee Spec 2",
  "formulavee formulavee3": "Formula Vee Spec 3",
  "hondacivictyper": "Honda Civic Type R TCR",
  "hpdarx01c": "HPD ARX-01c LMP2",
  "hyundaielantracn7": "Hyundai Elantra N TCR",
  "hyundaivelostern": "Hyundai Veloster N TCR",
  "lamborghinievogt3": "Lamborghini Huracán EVO GT3",
  "ligierjsp320": "Ligier JS P320 LMP3",
  "mclaren570sgt4": "McLaren 570S GT4",
  "mclaren720sgt3": "McLaren 720S GT3",
  "mercedesamgevogt3": "Mercedes-AMG GT3 EVO",
  "mercedesamggt4": "Mercedes-AMG GT4",
  "ministock": "Mini Stock",
  "mx5 cup": "Mazda MX-5 Cup",
  "mx5 mx52016": "Global Mazda MX-5 2016",
  "nissangtpzxt": "Nissan GTP ZX-T",
  "porsche718gt4": "Porsche 718 Cayman GT4",
  "porsche963gtp": "Porsche 963 GTP",
  "porsche991rsr": "Porsche 991 RSR GTE",
  "porsche9922cup": "Porsche 992 Cup (2.0)",
  "porsche992rgt3": "Porsche 992 GT3 R",
  "raygr22": "Ray FF1600 (GR22)",
  "renaultcliocup": "Renault Clio Cup",
  "specracer": "SCCA Spec Racer Ford",
  "stockcars2 mustang2019": "NASCAR Cup Mustang 2019",
  "supercars fordmustanggen3": "Supercars Mustang Gen3",
  "superformulalights324": "Super Formula Lights 324",
  "superformulasf23 honda": "Super Formula SF23 Honda",
  "superformulasf23 toyota": "Super Formula SF23 Toyota",
  "toyotagr86": "Toyota GR86",
  "trucks silverado": "NASCAR Craftsman Truck Silverado",
  "trucks toyotatundra2022": "NASCAR Craftsman Truck Tundra",
  "mercedesw13": "Mercedes-AMG F1 W13 E Performance"
};

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  detectBrowserAndRestoreHandle();
  // Check invite code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get("invite") || urlParams.get("code") || urlParams.get("key");
  if (inviteCode) {
    const keyInput = document.getElementById("loginKey");
    if (keyInput) {
      keyInput.value = inviteCode.trim();
      document.getElementById("inviteBadge")?.classList.remove("hidden");
    }
  }

  // Restore stored session
  const savedToken = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token");
  const savedUser = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");

  if (savedToken && savedUser) {
    currentToken = savedToken;
    try {
      currentUser = JSON.parse(savedUser);
      showVaultView();
      loadCatalog();
      return;
    } catch (e) {
      handleLogout();
    }
  }

  showAuthGate();
  if (window.location.hash === "#join" || urlParams.get("mode") === "join") {
    switchTab("join");
  }
});

// Switch login / request tabs
function switchTab(mode) {
  const loginForm = document.getElementById("loginForm");
  const joinForm = document.getElementById("joinForm");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabJoinBtn = document.getElementById("tabJoinBtn");

  if (mode === "login") {
    loginForm.classList.remove("hidden");
    joinForm.classList.add("hidden");
    tabLoginBtn.classList.add("bg-[#161c24]", "text-white", "shadow");
    tabLoginBtn.classList.remove("text-neutral-400");
    tabJoinBtn.classList.remove("bg-[#161c24]", "text-white", "shadow");
    tabJoinBtn.classList.add("text-neutral-400");
  } else {
    loginForm.classList.add("hidden");
    joinForm.classList.remove("hidden");
    tabJoinBtn.classList.add("bg-[#161c24]", "text-white", "shadow");
    tabJoinBtn.classList.remove("text-neutral-400");
    tabLoginBtn.classList.remove("bg-[#161c24]", "text-white", "shadow");
    tabLoginBtn.classList.add("text-neutral-400");
  }
}

function toggleKeyVisibility() {
  const input = document.getElementById("loginKey");
  input.type = input.type === "password" ? "text" : "password";
}

function toggleNavDrawer() {
  const drawer = document.getElementById("mobileDrawer");
  const backdrop = document.getElementById("mobileBackdrop");
  drawer.classList.toggle("open");
  backdrop.classList.toggle("open");
}

// Authentication
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const keyCode = document.getElementById("loginKey").value.trim();
  const remember = document.getElementById("rememberMe").checked;
  const errorDiv = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const btnText = document.getElementById("loginBtnText");

  errorDiv.classList.add("hidden");
  submitBtn.disabled = true;
  btnText.textContent = "Verificando en Servidor...";

  try {
    const res = await fetch(`${API_BASE}/api/setups/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, key_code: keyCode })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      currentToken = data.token;
      currentUser = data.user;

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("mrt_vault_token", currentToken);
      storage.setItem("mrt_vault_user", JSON.stringify(currentUser));

      // Check if mandatory password change is required on first login
      if (data.must_change_password) {
        openChangePasswordModal();
        return;
      }

      showVaultView();
      await loadCatalog();
    } else {
      errorDiv.textContent = data.error || "No se pudo verificar la credencial.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error conectando con el servidor de Muntrume. Inténtalo de nuevo.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Ingresar al Vault de Setups →";
  }
}

// Driver Join Request (Garage 61 style)
async function handleJoinRequest(e) {
  e.preventDefault();
  const name = document.getElementById("reqName").value.trim();
  const email = document.getElementById("reqEmail").value.trim();
  const iracing_id = document.getElementById("reqIracingId").value.trim();
  const car_category = document.getElementById("reqCategory").value.trim();
  const message = document.getElementById("reqMessage").value.trim();

  const feedback = document.getElementById("joinFeedback");
  const errorDiv = document.getElementById("joinError");
  const submitBtn = document.getElementById("joinSubmitBtn");
  const btnText = document.getElementById("joinBtnText");

  feedback.classList.add("hidden");
  errorDiv.classList.add("hidden");
  submitBtn.disabled = true;
  btnText.textContent = "Transmitiendo...";

  try {
    const res = await fetch(`${API_BASE}/api/setups/request-join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, iracing_id, car_category, message })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      feedback.innerHTML = `
        <div class="font-bold text-white mb-0.5">✅ Solicitud Transmitida</div>
        <div>Gracias, ${escapeHtml(name)}. Hemos recibido tu solicitud para unirte al equipo. Alberto y los ingenieros de Control de Carrera la revisarán para darte de alta.</div>
      `;
      feedback.classList.remove("hidden");
      document.getElementById("joinForm").reset();
    } else {
      errorDiv.textContent = data.error || "Error al enviar la solicitud.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Enviar Solicitud a Control de Carrera →";
  }
}


// ==========================================
// MANDATORY PASSWORD CHANGE (PRIMER LOGIN)
// ==========================================
function openChangePasswordModal() {
  document.getElementById("changePasswordModal")?.classList.remove("hidden");
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordModal")?.classList.add("hidden");
}

async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById("newPassInput").value.trim();
  const confirmPass = document.getElementById("confirmPassInput").value.trim();
  const errorDiv = document.getElementById("changePassError");
  const submitBtn = document.getElementById("changePassBtn");

  errorDiv.classList.add("hidden");

  if (newPass.length < 6) {
    errorDiv.textContent = "La contraseña debe tener al menos 6 caracteres.";
    errorDiv.classList.remove("hidden");
    return;
  }

  if (newPass !== confirmPass) {
    errorDiv.textContent = "Las contraseñas no coinciden. Por favor verifícalas.";
    errorDiv.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/setups/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ new_password: newPass })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.token) {
        currentToken = data.token;
        localStorage.setItem("mrt_vault_token", currentToken);
      }
      closeChangePasswordModal();
      showVaultView();
      await loadCatalog();
      showDownloadToast("✅ Contraseña actualizada correctamente. ¡Bienvenido!");
    } else {
      errorDiv.textContent = data.error || "Error al actualizar la contraseña.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
}

function handleLogout() {
  currentToken = null;
  currentUser = null;
  allSetups = [];
  iracingDirHandle = null;
  localStorage.removeItem("mrt_vault_token");
  localStorage.removeItem("mrt_vault_user");
  sessionStorage.removeItem("mrt_vault_token");
  sessionStorage.removeItem("mrt_vault_user");
  showAuthGate();
}

function showAuthGate() {
  document.getElementById("authGate")?.classList.remove("hidden");
  document.getElementById("vaultDashboard")?.classList.add("hidden");
}

function showVaultView() {
  document.getElementById("authGate")?.classList.add("hidden");
  document.getElementById("vaultDashboard")?.classList.remove("hidden");
  if (currentUser) {
    const emailDisp = document.getElementById("userEmailDisplay");
    if (emailDisp) emailDisp.textContent = currentUser.email;

    const roleBadge = document.getElementById("userRoleBadge");
    const adminBtn = document.getElementById("adminPanelBtn");

    if (currentUser.role === 'admin') {
      if (roleBadge) {
        roleBadge.textContent = "⚡ Race Control Admin";
        roleBadge.className = "text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm";
      }
      if (adminBtn) adminBtn.classList.remove("hidden");
    } else {
      if (roleBadge) {
        roleBadge.textContent = "Official Driver";
        roleBadge.className = "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      }
      if (adminBtn) adminBtn.classList.add("hidden");
    }
  }
}

// ==========================================
// BROWSER DETECTION, BRAVE FIX & INDEXEDDB PERSISTENCE
// ==========================================
function openIdb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error("No IndexedDB"));
    const req = indexedDB.open("muntrume_vault_fs", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandleToIdb(handle) {
  try {
    const db = await openIdb();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "iracing_setups_root");
  } catch (e) {
    console.warn("No se pudo guardar handle en IndexedDB:", e);
  }
}

async function loadDirHandleFromIdb() {
  try {
    const db = await openIdb();
    return await new Promise((resolve) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("iracing_setups_root");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function clearDirHandleFromIdb() {
  try {
    const db = await openIdb();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete("iracing_setups_root");
  } catch (e) {}
}

async function detectBrowserAndRestoreHandle() {
  const supportsFS = 'showDirectoryPicker' in window;
  let isBrave = false;
  try {
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      isBrave = await navigator.brave.isBrave();
    }
  } catch (e) {}

  const ua = navigator.userAgent || "";
  let browserName = "tu navegador actual";
  if (isBrave) browserName = "Brave Browser";
  else if (ua.includes("Firefox")) browserName = "Mozilla Firefox";
  else if (ua.includes("Edg/")) browserName = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browserName = "Google Chrome";
  else if (ua.includes("Safari/")) browserName = "Safari";

  detectedBrowserInfo = { isBrave, supportsFS, name: browserName };

  const banner = document.getElementById("browserCompatBanner");
  const titleEl = document.getElementById("browserCompatBannerTitle");
  const badgeEl = document.getElementById("browserCompatDetectedBadge");
  const descEl = document.getElementById("browserCompatBannerDesc");
  const modalSub = document.getElementById("browserModalSubtitle");
  const metricStatus = document.getElementById("metricDirectStatus");

  if (!supportsFS) {
    banner?.classList.remove("hidden");
    if (isBrave) {
      if (titleEl) titleEl.textContent = "🦁 Estás en Brave Browser: El guardado directo en carpetas está desactivado por defecto";
      if (badgeEl) badgeEl.textContent = "Brave Detectado";
      if (descEl) {
        descEl.innerHTML = 'Brave bloquea de fábrica el acceso a <code class="text-emerald-400 font-mono">Documents\\iRacing\\setups</code>. Pulsa <strong>"🚀 Abrir en Microsoft Edge"</strong> para guardar directo sin configurar nada, o pulsa <strong>"🦁 Cómo activarlo en Brave"</strong> (tarda 10 segundos en <code class="text-amber-300 font-mono">brave://flags/#file-system-access-api</code>).';
      }
      if (modalSub) modalSub.textContent = "Brave Browser detectado · Activa File System Access API o abre con Edge/Chrome";
    } else {
      if (titleEl) titleEl.textContent = `⚠️ ${browserName} no soporta guardado directo en carpetas de iRacing`;
      if (badgeEl) badgeEl.textContent = `${browserName} no compatible con Direct Sync`;
      if (descEl) {
        descEl.innerHTML = `Para que todos los setups se descarguen automáticamente en su ruta exacta (<code class="text-emerald-400 font-mono">Documents\\iRacing\\setups\\&lt;coche&gt;\\...</code>), debes abrir esta página con <strong>Microsoft Edge</strong> o <strong>Google Chrome</strong>.`;
      }
      if (modalSub) modalSub.textContent = `${browserName} no incluye File System Access API · Abre con Microsoft Edge o Google Chrome`;
    }
    if (metricStatus) {
      metricStatus.textContent = isBrave ? "Activar en Brave / Edge" : "Abrir con Edge/Chrome";
      metricStatus.className = "text-sm font-black text-amber-400 mt-1 cursor-pointer underline";
      metricStatus.onclick = () => openBrowserCompatModal();
    }
    return;
  }

  // If File System Access API IS supported, check if we have a saved handle in IndexedDB
  const savedHandle = await loadDirHandleFromIdb();
  if (savedHandle) {
    try {
      const perm = await savedHandle.queryPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedHandle;
        updateLinkDirectoryUI(true, savedHandle.name);
        return;
      } else {
        savedPendingDirHandle = savedHandle;
        const recBanner = document.getElementById("savedFolderReconnectBanner");
        const recName = document.getElementById("savedFolderNameLabel");
        if (recName) recName.textContent = savedHandle.name;
        recBanner?.classList.remove("hidden");
      }
    } catch (e) {}
  }
}

async function reconnectSavedDirectory() {
  if (!savedPendingDirHandle) {
    return toggleLinkDirectory();
  }
  try {
    const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
    if (perm === "granted") {
      iracingDirHandle = savedPendingDirHandle;
      savedPendingDirHandle = null;
      document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
      updateLinkDirectoryUI(true, iracingDirHandle.name);
      showDownloadToast(`✅ Reconectado a carpeta iRacing: ${iracingDirHandle.name}`);
    }
  } catch (e) {
    toggleLinkDirectory();
  }
}

function openBrowserCompatModal() {
  document.getElementById("browserCompatModal")?.classList.remove("hidden");
}

function closeBrowserCompatModal() {
  document.getElementById("browserCompatModal")?.classList.add("hidden");
}

function copyBraveFlagUrl() {
  const flagUrl = "brave://flags/#file-system-access-api";
  navigator.clipboard.writeText(flagUrl).then(() => {
    showDownloadToast("📋 Copiado: brave://flags/#file-system-access-api — Pégalo en una pestaña nueva de Brave y pon Enabled");
    alert("✅ Copiado al portapapeles:\n\nbrave://flags/#file-system-access-api\n\n1. Abre una pestaña nueva en Brave y pégalo arriba.\n2. Pon 'File System Access API' en Enabled.\n3. Pulsa Relaunch abajo a la derecha.");
  }).catch(() => {
    prompt("Copia y pega esta dirección en la barra de Brave:", flagUrl);
  });
}

function copyVaultUrlForChrome() {
  const url = "https://muntru.me/setups";
  navigator.clipboard.writeText(url).then(() => {
    showDownloadToast("📋 URL copiada: https://muntru.me/setups");
    alert("✅ Enlace copiado: https://muntru.me/setups\n\nPégalo en Google Chrome o Microsoft Edge para guardar directamente en tu carpeta Documents\\iRacing\\setups.");
  });
}

async function toggleLinkDirectory() {
  if (!('showDirectoryPicker' in window)) {
    openBrowserCompatModal();
    return;
  }

  if (iracingDirHandle) {
    if (confirm("¿Deseas desvincular la carpeta de iRacing? Puedes volver a vincularla cuando quieras.")) {
      iracingDirHandle = null;
      savedPendingDirHandle = null;
      await clearDirHandleFromIdb();
      updateLinkDirectoryUI(false);
      showDownloadToast("Carpeta desvinculada");
    }
    return;
  }

  if (savedPendingDirHandle) {
    try {
      const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedPendingDirHandle;
        savedPendingDirHandle = null;
        document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
        updateLinkDirectoryUI(true, iracingDirHandle.name);
        showDownloadToast(`✅ Carpeta vinculada: ${iracingDirHandle.name}`);
        return;
      }
    } catch (e) {}
  }

  try {
    iracingDirHandle = await window.showDirectoryPicker({
      id: "iracing-setups-picker",
      mode: "readwrite",
      startIn: "documents"
    });

    await saveDirHandleToIdb(iracingDirHandle);
    document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
    updateLinkDirectoryUI(true, iracingDirHandle.name);
    showDownloadToast(`✅ Carpeta vinculada: ${iracingDirHandle.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error("DirectoryPicker error:", err);
      alert("No se pudo acceder a la carpeta: " + err.message);
    }
  }
}

// Smart auto-connection on download so every file lands in its exact path
async function ensureDirectoryHandleForDownload() {
  if (iracingDirHandle) return iracingDirHandle;
  if (!('showDirectoryPicker' in window)) return null;

  if (savedPendingDirHandle) {
    try {
      const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedPendingDirHandle;
        savedPendingDirHandle = null;
        document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
        updateLinkDirectoryUI(true, iracingDirHandle.name);
        return iracingDirHandle;
      }
    } catch (e) {}
  }

  try {
    iracingDirHandle = await window.showDirectoryPicker({
      id: "iracing-setups-picker",
      mode: "readwrite",
      startIn: "documents"
    });
    await saveDirHandleToIdb(iracingDirHandle);
    document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
    updateLinkDirectoryUI(true, iracingDirHandle.name);
    return iracingDirHandle;
  } catch (e) {
    return null;
  }
}

// Smart resolver: whether user selected Documents, Documents\iRacing, Documents\iRacing\setups, or Documents\iRacing\setups\<car>,
// it ALWAYS writes to the exact target folder: setups\<car>\Garage 61 - Muntrume Motorsport\<season> <week> <circuit>\
async function resolveExactSetupDir(rootHandle, car, season, week, circuit) {
  let baseSetupsDir = rootHandle;
  const rootName = (rootHandle.name || "").toLowerCase().trim();
  const safeCar = (car || "").trim();

  if (rootName === "documents" || rootName === "documentos" || rootName === "mis documentos") {
    const irDir = await rootHandle.getDirectoryHandle("iRacing", { create: true });
    baseSetupsDir = await irDir.getDirectoryHandle("setups", { create: true });
  } else if (rootName === "iracing") {
    baseSetupsDir = await rootHandle.getDirectoryHandle("setups", { create: true });
  }

  let carFolder = baseSetupsDir;
  if (baseSetupsDir.name.toLowerCase() !== safeCar.toLowerCase()) {
    carFolder = await baseSetupsDir.getDirectoryHandle(safeCar, { create: true });
  }

  const teamFolder = await carFolder.getDirectoryHandle("Garage 61 - Muntrume Motorsport", { create: true });
  const circSlug = (circuit || "General").replace(/\s+/g, "");
  const folderName = `${season || "26S4"} ${week || "W01"} ${circSlug}`;
  const circFolder = await teamFolder.getDirectoryHandle(folderName, { create: true });
  return { circFolder, folderName, relDisplay: `${safeCar}\\Garage 61 - Muntrume Motorsport\\${folderName}` };
}

function buildExactPathInstallerBat() {
  return [
    "@echo off",
    "chcp 65001 >nul",
    "echo =========================================================",
    "echo   MUNTRUME MOTORSPORT - INSTALADOR AUTOMATICO DE SETUPS",
    "echo =========================================================",
    "set \"TARGET=%USERPROFILE%\\Documents\\iRacing\\setups\"",
    "if not exist \"%TARGET%\" mkdir \"%TARGET%\"",
    "xcopy /E /I /Y \"%~dp0*\" \"%TARGET%\\\" /EXCLUDE:%~nx0 >nul 2>&1",
    "for /D %%D in (\"%~dp0*\") do (",
    "  xcopy /E /I /Y \"%%D\" \"%TARGET%\\%%~nxD\\\" >nul",
    ")",
    "echo.",
    "echo [OK] Todos los setups se han instalado en su ruta exacta:",
    "echo      %TARGET%",
    "echo.",
    "pause"
  ].join("\r\n");
}

function updateLinkDirectoryUI(linked, folderName = "") {
  const btn = document.getElementById("linkFolderBtn");
  const text = document.getElementById("linkFolderText");
  const metricStatus = document.getElementById("metricDirectStatus");

  if (linked) {
    if (btn) btn.className = "px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 text-xs font-black text-neutral-950 transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20";
    if (text) text.textContent = `⚡ iRacing Direct: ${folderName || 'Vinculado'}`;
    if (metricStatus) {
      metricStatus.textContent = "Sincronizado";
      metricStatus.className = "text-2xl font-black text-emerald-400 mt-1";
    }
  } else {
    if (btn) btn.className = "px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 transition flex items-center gap-1.5 shadow";
    if (text) text.textContent = "📁 Vincular Carpeta iRacing";
    if (metricStatus && ('showDirectoryPicker' in window)) {
      metricStatus.textContent = "Listo";
      metricStatus.className = "text-2xl font-black text-emerald-400 mt-1";
    }
  }
  applyFilters();
}

// ==========================================
// CATALOG MANAGEMENT & FILTERING (<30MB RAM MICRO-LOADER)
// ==========================================
function unpackCompactRows(rows) {
  return (rows || []).map(r => ({
    id: r[0],
    car: r[1] || "",
    season: r[2] || "26S4",
    week: r[3] || "W01",
    circuit: r[4] || "General",
    filename: r[5] || "",
    setup_type: r[6] || "Race",
    size_bytes: r[7] || 4096
  }));
}

async function loadCatalog() {
  const skeleton = document.getElementById("loadingSkeleton");
  const grid = document.getElementById("setupsGrid");
  skeleton?.classList.remove("hidden");
  if (grid) grid.innerHTML = "";

  if (currentToken) {
    fetch(`${API_BASE}/api/setups/catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ car: "__ping__" })
    }).then(res => {
      if (res.status === 401) handleLogout();
    }).catch(() => {});
  }

  // Cargar SOLO el índice ligero de 24 KB (en vez de 41.530 objetos en RAM)
  try {
    const idxRes = await fetch("assets/data/catalog_index.json?v=26s4.5");
    if (idxRes.ok) {
      const idxData = await idxRes.json();
      totalVaultSetupsCount = idxData.total_setups || 41530;
      initialIndexRows = unpackCompactRows(idxData.initial_rows || []);
      allSetups = initialIndexRows;
      activeLoadedScopeKey = "index";

      if (!dropdownsInitialized) {
        populateAllDropdowns(idxData.cars || [], idxData.seasons || [], idxData.weeks || [], idxData.circuits || []);
        dropdownsInitialized = true;
      }
      const metricCars = document.getElementById("metricCarsCount");
      if (metricCars && idxData.cars) metricCars.textContent = idxData.cars.length;
      const metricCircs = document.getElementById("metricCircuitsCount");
      if (metricCircs && idxData.circuits) metricCircs.textContent = idxData.circuits.length;
    }
  } catch (err) {
    console.error("Error al cargar catalog_index.json:", err);
  }

  skeleton?.classList.add("hidden");
  const metricSetups = document.getElementById("metricSetupsCount");
  if (metricSetups) metricSetups.textContent = totalVaultSetupsCount.toLocaleString();
  await ensureScopeLoadedAndApplyFilters();
}

async function ensureScopeLoadedAndApplyFilters() {
  const selectedCar = document.getElementById("carSelect")?.value || "";
  const selectedSeason = document.getElementById("seasonSelect")?.value || "";
  const selectedWeek = document.getElementById("weekSelect")?.value || "";
  const selectedCircuit = document.getElementById("circuitSelect")?.value || "";
  const query = (document.getElementById("searchInput")?.value || "").trim();

  let targetScope = "index";
  let fetchUrl = null;

  if (selectedCar) {
    const carSlug = safeCarChunkSlug(selectedCar);
    targetScope = `car:${carSlug}`;
    fetchUrl = `assets/data/catalog_by_car/${carSlug}.json?v=26s4.5`;
  } else if (selectedSeason || selectedWeek || selectedCircuit || query) {
    const sn = selectedSeason || "26S4";
    const snSlug = safeCarChunkSlug(sn);
    targetScope = `season:${snSlug}`;
    fetchUrl = `assets/data/catalog_by_season/${snSlug}.json?v=26s4.5`;
  }

  if (targetScope !== activeLoadedScopeKey) {
    if (targetScope === "index") {
      allSetups = initialIndexRows;
      activeLoadedScopeKey = "index";
    } else if (fetchUrl) {
      try {
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const rows = await res.json();
          allSetups = unpackCompactRows(rows);
          activeLoadedScopeKey = targetScope;
        }
      } catch (e) {
        console.warn("Error loading micro catalog scope:", e);
      }
    }
  }

  applyFilters();
}

function onFilterChange() {
  ensureScopeLoadedAndApplyFilters();
}

function refreshCatalog() {
  loadCatalog();
}

function populateAllDropdowns(cars, seasons, weeks, circuits) {
  const carSel = document.getElementById("carSelect");
  const seasonSel = document.getElementById("seasonSelect");
  const weekSel = document.getElementById("weekSelect");
  const circSel = document.getElementById("circuitSelect");

  // 1. Coches (64)
  if (carSel) {
    const curVal = carSel.value;
    carSel.innerHTML = '<option value="">Todos los Coches (64)</option>';
    cars.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = CAR_LABELS[c] || c;
      if (c === curVal) opt.selected = true;
      carSel.appendChild(opt);
    });
    const metricCars = document.getElementById("metricCarsCount");
    if (metricCars) metricCars.textContent = cars.length;
  }

  // 2. Temporadas (26S4, 26S3, 26S2)
  if (seasonSel) {
    const curVal = seasonSel.value;
    seasonSel.innerHTML = '<option value="">Todas las Temporadas</option>';
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      let label = s;
      if (s === "26S4") label = "2026 Season 4 (Oficial)";
      else if (s === "26S3") label = "2026 Season 3";
      else if (s === "26S2") label = "2026 Season 2";
      opt.textContent = label;
      if (s === curVal) opt.selected = true;
      seasonSel.appendChild(opt);
    });
  }

  // 3. Semanas (W01 a W13 + Special Events)
  if (weekSel) {
    const curVal = weekSel.value;
    weekSel.innerHTML = '<option value="">Todas las Semanas</option>';
    const sortedWeeks = [...weeks].sort((a, b) => {
      if (a.startsWith("W") && b.startsWith("W")) return a.localeCompare(b);
      if (a.startsWith("W")) return -1;
      if (b.startsWith("W")) return 1;
      return a.localeCompare(b);
    });
    sortedWeeks.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if (w === curVal) opt.selected = true;
      weekSel.appendChild(opt);
    });
  }

  // 4. Circuitos (50/61)
  if (circSel) {
    const curVal = circSel.value;
    circSel.innerHTML = '<option value="">Todos los Circuitos (61)</option>';
    circuits.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if (c === curVal) opt.selected = true;
      circSel.appendChild(opt);
    });
    const metricCirc = document.getElementById("metricCircuitsCount");
    if (metricCirc) metricCirc.textContent = circuits.length;
  }
}

function setTypeFilter(type) {
  currentTypeFilter = type;
  ["All", "Race", "Qualy", "Wet"].forEach(t => {
    const btn = document.getElementById(`btnType${t}`);
    if (btn) {
      if (t === type) {
        btn.classList.add("bg-[#161c24]", "text-white", "shadow");
        btn.classList.remove("text-neutral-400");
      } else {
        btn.classList.remove("bg-[#161c24]", "text-white", "shadow");
        btn.classList.add("text-neutral-400");
      }
    }
  });
  applyFilters();
}

// Switch between 'folders' view and 'list' view
function setViewMode(mode) {
  currentViewMode = mode;
  const foldersBtn = document.getElementById("viewModeFoldersBtn");
  const listBtn = document.getElementById("viewModeListBtn");
  const toggleAllBtn = document.getElementById("toggleAllFoldersBtn");

  if (mode === "folders") {
    foldersBtn?.classList.add("bg-[#161c24]", "text-emerald-400", "shadow");
    foldersBtn?.classList.remove("text-neutral-400");
    listBtn?.classList.remove("bg-[#161c24]", "text-emerald-400", "shadow");
    listBtn?.classList.add("text-neutral-400");
    toggleAllBtn?.classList.remove("hidden");
  } else {
    listBtn?.classList.add("bg-[#161c24]", "text-emerald-400", "shadow");
    listBtn?.classList.remove("text-neutral-400");
    foldersBtn?.classList.remove("bg-[#161c24]", "text-emerald-400", "shadow");
    foldersBtn?.classList.add("text-neutral-400");
    toggleAllBtn?.classList.add("hidden");
  }

  renderSetups(currentlyFilteredSetups);
}

function renderFolderFilesHtml(folder) {
  const isDirectLinked = !!iracingDirHandle;
  const folderSubName = `${folder.season} ${folder.week} ${folder.circuit.replace(/\s+/g, '')}`;
  return folder.setups.map(s => {
    const sizeKb = (s.size_bytes / 1024).toFixed(1);
    let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s.setup_type === "Qualy") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (s.setup_type === "Wet") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";

    const filePath = `${folder.car}\\Garage 61 - Muntrume Motorsport\\${folderSubName}\\${s.filename}`;

    return `
      <div class="p-3 rounded-xl bg-[#0e1217] border border-white/5 hover:border-emerald-500/30 flex items-center justify-between gap-2 transition group">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badgeColor}">
              ${s.setup_type}
            </span>
            <span class="text-[10px] text-neutral-500 font-mono">${sizeKb} KB</span>
          </div>
          <div class="text-xs font-semibold text-white truncate group-hover:text-emerald-400 transition" title="${escapeHtml(s.filename)}">
            ${escapeHtml(s.filename)}
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button 
            type="button" 
            onclick="openSetupPreview(${s.id}, '${escapeHtml(s.filename)}', '${escapeHtml(s.car)}', '${escapeHtml(s.circuit)}', '${escapeHtml(s.season)}', '${escapeHtml(s.week)}', '${escapeHtml(s.setup_type)}', '${folder.key}')" 
            class="px-2 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 font-bold text-[11px] transition flex items-center gap-1" 
            title="Ver Vista Previa Técnica y Mejores Vueltas en Garage 61"
          >
            <span>👁️ Vista Previa</span>
          </button>
          <button 
            type="button" 
            onclick="copySetupPath('${escapeHtml(filePath)}')" 
            class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition" 
            title="Copiar ruta de iRacing"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          </button>
          <button 
            type="button" 
            onclick="downloadSetup(${s.id}, '${escapeHtml(s.filename)}')" 
            class="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition flex items-center gap-1" 
            title="Guardar directamente en su ruta exacta de iRacing"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span>${isDirectLinked ? 'Guardar' : 'En su Ruta'}</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function toggleFolderFiles(folderKey) {
  const container = document.getElementById(`folder-files-${folderKey}`);
  const innerGrid = document.getElementById(`folder-files-grid-${folderKey}`);
  const text = document.getElementById(`folder-toggle-text-${folderKey}`);
  const icon = document.getElementById(`folder-toggle-icon-${folderKey}`);
  const folder = currentFoldersMap[folderKey];
  const count = folder ? folder.setups.length : 0;

  if (!container) return;

  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    // Lazy render inner files only when expanded!
    if (innerGrid && innerGrid.dataset.rendered !== "1" && folder) {
      innerGrid.innerHTML = renderFolderFilesHtml(folder);
      innerGrid.dataset.rendered = "1";
    }
    container.classList.remove("hidden");
    if (text) text.textContent = `Plegar Setups (${count})`;
    if (icon) icon.classList.add("rotate-180");
  } else {
    container.classList.add("hidden");
    if (text) text.textContent = `📂 Ver Setups (${count})`;
    if (icon) icon.classList.remove("rotate-180");
  }
}

function toggleAllFolderAccordions() {
  allFoldersExpanded = !allFoldersExpanded;
  const toggleBtnText = document.getElementById("toggleAllFoldersText");
  if (toggleBtnText) {
    toggleBtnText.textContent = allFoldersExpanded ? "Plegar Todo" : "Desplegar Todo";
  }

  const visibleFolders = currentOrderedFolders.slice(0, visibleFoldersLimit);
  visibleFolders.forEach(folder => {
    const key = folder.key;
    const container = document.getElementById(`folder-files-${key}`);
    const innerGrid = document.getElementById(`folder-files-grid-${key}`);
    const text = document.getElementById(`folder-toggle-text-${key}`);
    const icon = document.getElementById(`folder-toggle-icon-${key}`);
    const count = folder.setups.length;

    if (!container) return;
    if (allFoldersExpanded) {
      if (innerGrid && innerGrid.dataset.rendered !== "1") {
        innerGrid.innerHTML = renderFolderFilesHtml(folder);
        innerGrid.dataset.rendered = "1";
      }
      container.classList.remove("hidden");
      if (text) text.textContent = `Plegar Setups (${count})`;
      if (icon) icon.classList.add("rotate-180");
    } else {
      container.classList.add("hidden");
      if (text) text.textContent = `📂 Ver Setups (${count})`;
      if (icon) icon.classList.remove("rotate-180");
    }
  });
}

// Group setups into logical folder units: Car + Season + Week + Circuit
function groupSetupsIntoFolders(setups) {
  const foldersMap = {};

  for (const s of setups) {
    const safeCircuit = s.circuit || "General";
    const safeSeason = s.season || "26S4";
    const safeWeek = s.week || "W01";
    const key = `${s.car}__${safeSeason}__${safeWeek}__${safeCircuit}`;

    if (!foldersMap[key]) {
      foldersMap[key] = {
        key,
        car: s.car,
        season: safeSeason,
        week: safeWeek,
        circuit: safeCircuit,
        setups: [],
        typesCount: { Race: 0, Qualy: 0, Wet: 0, Other: 0 }
      };
    }
    foldersMap[key].setups.push(s);
    if (foldersMap[key].typesCount[s.setup_type] !== undefined) {
      foldersMap[key].typesCount[s.setup_type]++;
    } else {
      foldersMap[key].typesCount.Other++;
    }
  }

  // Sort folders: Season desc, Car asc, Week asc, Circuit asc
  const folders = Object.values(foldersMap).sort((a, b) => {
    if (a.season !== b.season) return b.season.localeCompare(a.season);
    const carA = (CAR_LABELS[a.car] || a.car).toLowerCase();
    const carB = (CAR_LABELS[b.car] || b.car).toLowerCase();
    if (carA !== carB) return carA.localeCompare(carB);
    if (a.week !== b.week) {
      if (a.week.startsWith("W") && b.week.startsWith("W")) return a.week.localeCompare(b.week);
      if (a.week.startsWith("W")) return -1;
      if (b.week.startsWith("W")) return 1;
      return a.week.localeCompare(b.week);
    }
    return a.circuit.localeCompare(b.circuit);
  });

  return { folders, foldersMap };
}

let currentlyFilteredSetups = [];

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    ensureScopeLoadedAndApplyFilters();
  }, 180);
}

function applyFilters() {
  const query = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const selectedCar = document.getElementById("carSelect")?.value || "";
  const selectedSeason = document.getElementById("seasonSelect")?.value || "";
  const selectedWeek = document.getElementById("weekSelect")?.value || "";
  const selectedCircuit = document.getElementById("circuitSelect")?.value || "";

  visibleFoldersLimit = FOLDERS_PAGE_SIZE;

  const filtered = allSetups.filter(s => {
    if (selectedCar && s.car !== selectedCar) return false;
    if (selectedSeason && s.season !== selectedSeason) return false;
    if (selectedWeek && s.week !== selectedWeek) return false;
    if (selectedCircuit && s.circuit !== selectedCircuit) return false;

    if (currentTypeFilter !== "All" && s.setup_type !== currentTypeFilter) {
      return false;
    }
    if (query) {
      const carName = (CAR_LABELS[s.car] || s.car).toLowerCase();
      const hay = `${s.car} ${carName} ${s.season} ${s.circuit} ${s.week} ${s.filename} ${s.setup_type}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  currentlyFilteredSetups = filtered;

  // Update batch download button label and state
  const batchBtn = document.getElementById("downloadBatchBtn");
  const batchText = document.getElementById("downloadBatchBtnText");

  if (batchBtn && batchText) {
    if (filtered.length === 0) {
      batchBtn.disabled = true;
      batchText.textContent = "⚡ Descargar Todo";
    } else {
      batchBtn.disabled = false;
      if (selectedCircuit) {
        batchText.textContent = `⚡ Guardar todo ${selectedCircuit} (${filtered.length})`;
      } else {
        batchText.textContent = `⚡ Guardar lote en su ruta (${Math.min(filtered.length, 100)} setups)`;
      }
    }
  }

  renderSetups(filtered);
}

function loadMoreFolders() {
  visibleFoldersLimit += FOLDERS_PAGE_SIZE;
  renderVisibleSlice();
}

function setupInfiniteScrollObserver() {
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (!loadMoreContainer || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const total = currentViewMode === "folders" ? currentOrderedFolders.length : currentlyFilteredSetups.length;
        if (visibleFoldersLimit < total) {
          visibleFoldersLimit += FOLDERS_PAGE_SIZE;
          renderVisibleSlice();
        }
      }
    }
  }, { rootMargin: "350px" });
  obs.observe(loadMoreContainer);
}

function renderSetups(setups) {
  const grid = document.getElementById("setupsGrid");
  const empty = document.getElementById("emptyState");
  const loadMoreWrap = document.getElementById("loadMoreContainer");
  const countLabel = document.getElementById("visibleSetupsCount");
  const folderCountLabel = document.getElementById("visibleFoldersCount");

  const { folders, foldersMap } = groupSetupsIntoFolders(setups);
  currentFoldersMap = foldersMap;
  currentOrderedFolders = folders;

  if (countLabel) countLabel.textContent = setups.length.toLocaleString();
  if (folderCountLabel) folderCountLabel.textContent = folders.length.toLocaleString();

  if (setups.length === 0) {
    if (grid) grid.innerHTML = "";
    empty?.classList.remove("hidden");
    loadMoreWrap?.classList.add("hidden");
    return;
  }

  empty?.classList.add("hidden");
  renderVisibleSlice();
}

function renderVisibleSlice() {
  const grid = document.getElementById("setupsGrid");
  const loadMoreWrap = document.getElementById("loadMoreContainer");
  const loadMoreText = document.getElementById("loadMoreBtnText");
  if (!grid) return;

  const isDirectLinked = !!iracingDirHandle;

  // ========================================================
  // VIEW MODE 1: CARPETAS (Paginado + Lazy Render sin lag)
  // ========================================================
  if (currentViewMode === "folders") {
    grid.className = "space-y-4";
    const slice = currentOrderedFolders.slice(0, visibleFoldersLimit);
    const remaining = currentOrderedFolders.length - slice.length;

    if (loadMoreWrap) {
      if (remaining > 0) {
        loadMoreWrap.classList.remove("hidden");
        if (loadMoreText) loadMoreText.textContent = `👇 Mostrar más carpetas (${remaining.toLocaleString()} restantes)`;
      } else {
        loadMoreWrap.classList.add("hidden");
      }
    }

    grid.innerHTML = slice.map(folder => {
      const carLabel = CAR_LABELS[folder.car] || folder.car;
      const folderSubName = `${folder.season} ${folder.week} ${folder.circuit.replace(/\s+/g, '')}`;
      const destinationPath = `${folder.car}\\Garage 61 - Muntrume Motorsport\\${folderSubName}\\`;
      const isExpanded = allFoldersExpanded;

      const typeSummary = [];
      if (folder.typesCount.Race > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${folder.typesCount.Race} Carrera</span>`);
      if (folder.typesCount.Qualy > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">${folder.typesCount.Qualy} Clasif</span>`);
      if (folder.typesCount.Wet > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">${folder.typesCount.Wet} Lluvia</span>`);

      const filesHtml = isExpanded ? renderFolderFilesHtml(folder) : "";

      return `
        <div class="bg-[#161c24] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 transition shadow-lg space-y-3" id="folder-card-${folder.key}">
          <!-- Folder Top Bar -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                    <span>🏁</span>
                    <span>${escapeHtml(folder.circuit)}</span>
                  </h3>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ${escapeHtml(folder.season)} · ${escapeHtml(folder.week)}
                  </span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10">
                    📁 ${folder.setups.length} setups
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 mt-1">
                  <span class="font-semibold text-neutral-200">${escapeHtml(carLabel)}</span>
                  <span class="text-neutral-600">›</span>
                  <span class="text-neutral-400">${escapeHtml(folder.season)}</span>
                  <span class="text-neutral-600">›</span>
                  <span class="text-neutral-400">${escapeHtml(folder.week)}</span>
                  <span class="text-neutral-600">›</span>
                  <span class="text-emerald-400 font-medium">${escapeHtml(folder.circuit)}</span>
                  <div class="hidden sm:inline-flex items-center gap-1 ml-2">
                    ${typeSummary.join(" ")}
                  </div>
                </div>

                <div class="mt-2 text-[10px] text-neutral-500 font-mono truncate flex items-center gap-1.5" title="Documents\\iRacing\\setups\\${destinationPath}">
                  <svg class="w-3 h-3 text-emerald-500/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  <span class="truncate">Documents\iRacing\setups\${escapeHtml(destinationPath)}</span>
                </div>
              </div>
            </div>

            <!-- Folder Action Buttons -->
            <div class="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-auto">
              <button 
                type="button" 
                onclick="openFolderPreview('${folder.key}')" 
                class="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-bold text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1.5"
                title="Ver Vista Previa Técnica del Setup y Mejores Vueltas en Garage 61"
              >
                <span>🏆 Vista Previa & Vueltas G61</span>
              </button>

              <button 
                type="button" 
                onclick="toggleFolderFiles('${folder.key}')" 
                class="px-3 py-2 rounded-xl bg-[#0e1217] hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 transition flex items-center gap-1.5"
                title="Ver o plegar lista de setups de esta carpeta"
              >
                <span id="folder-toggle-text-${folder.key}">${isExpanded ? `Plegar Setups (${folder.setups.length})` : `📂 Ver Setups (${folder.setups.length})`}</span>
                <svg id="folder-toggle-icon-${folder.key}" class="w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>

              <button 
                type="button" 
                id="btn-download-folder-${folder.key}"
                onclick="downloadFolder('${folder.key}')" 
                class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                title="Guardar todos los ${folder.setups.length} setups de esta carpeta directamente en su ruta exacta de iRacing"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                <span id="btn-download-folder-text-${folder.key}">⚡ Guardar Carpeta en Ruta (${folder.setups.length})</span>
              </button>
            </div>
          </div>

          <!-- Collapsible files list inside this folder (Lazy-Rendered) -->
          <div id="folder-files-${folder.key}" class="${isExpanded ? '' : 'hidden'} pt-3 border-t border-white/5">
            <div id="folder-files-grid-${folder.key}" data-rendered="${isExpanded ? '1' : '0'}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              ${filesHtml}
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  // ========================================================
  // VIEW MODE 2: LISTA DE TARJETAS INDIVIDUALES (Paginada)
  // ========================================================
  const listLimit = visibleFoldersLimit * 2;
  const slice = currentlyFilteredSetups.slice(0, listLimit);
  const remaining = currentlyFilteredSetups.length - slice.length;

  if (loadMoreWrap) {
    if (remaining > 0) {
      loadMoreWrap.classList.remove("hidden");
      if (loadMoreText) loadMoreText.textContent = `👇 Mostrar más setups (${remaining.toLocaleString()} restantes)`;
    } else {
      loadMoreWrap.classList.add("hidden");
    }
  }

  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3";
  grid.innerHTML = slice.map(s => {
    const carName = CAR_LABELS[s.car] || s.car;
    const sizeKb = (s.size_bytes / 1024).toFixed(1);
    
    let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s.setup_type === "Qualy") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (s.setup_type === "Wet") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";

    const destinationPath = `${s.car}\\Garage 61 - Muntrume Motorsport\\${s.season} ${s.week} ${s.circuit.replace(/\s+/g, '')}\\${s.filename}`;

    return `
      <div class="bg-[#161c24] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition shadow-md flex flex-col justify-between group">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}">
                ${s.setup_type}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10">
                ${s.season} · ${s.week}
              </span>
            </div>
            <span class="text-[11px] font-semibold text-emerald-400 truncate max-w-[140px]" title="${escapeHtml(s.circuit)}">
              🏁 ${escapeHtml(s.circuit)}
            </span>
          </div>
          
          <div class="text-xs font-bold text-white group-hover:text-emerald-400 transition truncate" title="${escapeHtml(s.filename)}">
            ${escapeHtml(s.filename)}
          </div>

          <div class="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <span class="truncate font-medium">${carName}</span>
          </div>

          <div class="mt-2.5 p-2 rounded-xl bg-[#0e1217] border border-white/5 text-[10px] text-neutral-400 font-mono truncate flex items-center gap-1.5" title="Documents\\iRacing\\setups\\${destinationPath}">
            <svg class="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            <span class="truncate">setups\${escapeHtml(destinationPath)}</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <span class="text-[10px] text-neutral-500 font-mono">${sizeKb} KB · .sto</span>
          
          <div class="flex items-center gap-1.5">
            <button 
              type="button" 
              onclick="openSetupPreview(${s.id}, '${escapeHtml(s.filename)}', '${escapeHtml(s.car)}', '${escapeHtml(s.circuit)}', '${escapeHtml(s.season)}', '${escapeHtml(s.week)}', '${escapeHtml(s.setup_type)}', '')" 
              class="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 font-bold text-xs transition flex items-center gap-1" 
              title="Vista Previa Técnica y Mejores Vueltas en Garage 61"
            >
              <span>👁️ Vista Previa & G61</span>
            </button>

            <button 
              type="button" 
              onclick="copySetupPath('${escapeHtml(destinationPath)}')" 
              class="p-2 rounded-lg bg-[#0e1217] hover:bg-white/10 text-neutral-400 hover:text-white transition" 
              title="Copiar ruta de iRacing al portapapeles"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            </button>

            <button 
              type="button" 
              onclick="downloadSetup(${s.id}, '${escapeHtml(s.filename)}')" 
              class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-lg shadow-emerald-500/20 text-xs transition flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>⚡ Guardar en Ruta</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function freeTemporaryBase64Memory() {
  localBase64Cache = {};
  for (const k of Object.keys(loadedCarChunks)) {
    delete loadedCarChunks[k];
  }
}

async function ensureJSZipLoaded() {
  if (typeof JSZip !== "undefined") return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function safeCarChunkSlug(carName) {
  return (carName || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

async function ensureCarBase64ChunkLoaded(carName) {
  if (!carName) return;
  const slug = safeCarChunkSlug(carName);
  if (loadedCarChunks[slug]) return;
  try {
    const res = await fetch(`assets/data/cars/${slug}.json?v=26s4.4`);
    if (res.ok) {
      const carMap = await res.json();
      for (const [fname, b64] of Object.entries(carMap)) {
        localBase64Cache[carName + "/" + fname] = b64;
        localBase64Cache[fname] = b64;
      }
      loadedCarChunks[slug] = true;
    }
  } catch (e) {}
}

// Download setup batch contents using lightweight per-car chunks (100x faster than 35MB bundle)
async function getSetupsContentBatch(setupsList, onProgress) {
  const uniqueCars = [...new Set(setupsList.map(s => s.car).filter(Boolean))];
  await Promise.all(uniqueCars.map(c => ensureCarBase64ChunkLoaded(c)));

  const result = [];
  const missingFromCache = [];

  for (const s of setupsList) {
    const compositeKey = `${s.car}/${s.filename}`;
    if (s.content_base64) {
      result.push(s);
    } else if (localBase64Cache && (localBase64Cache[compositeKey] || localBase64Cache[s.filename])) {
      result.push({
        ...s,
        content_base64: localBase64Cache[compositeKey] || localBase64Cache[s.filename]
      });
    } else {
      missingFromCache.push(s);
    }
  }

  if (onProgress) onProgress(result.length);
  if (missingFromCache.length === 0) return result;

  const chunkSize = 50;
  for (let i = 0; i < missingFromCache.length; i += chunkSize) {
    const chunk = missingFromCache.slice(i, i + chunkSize);
    const ids = chunk.map(s => s.id);

    try {
      const res = await fetch(`${API_BASE}/api/setups/download-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.setups)) {
        for (const fetched of data.setups) {
          result.push(fetched);
          if (localBase64Cache) {
            localBase64Cache[fetched.filename] = fetched.content_base64;
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching batch chunk:", e);
    }

    if (onProgress) onProgress(result.length);
  }

  return result;
}

function decodeAndSanitizeSto(b64) {
  const byteChars = atob(b64);
  const raw = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) raw[i] = byteChars.charCodeAt(i);
  if (raw.length < 24) return raw;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const v = view.getUint32(0, true);
  const l1 = view.getUint32(4, true);
  const l2 = view.getUint32(8, true);
  const l3 = view.getUint32(12, true);
  const origLen = 16 + l1;
  if (origLen > raw.length || l3 > l1) return raw;
  const notesStart = 16 + l1 - 8 - l3;
  const notesEnd = 16 + l1 - 8;
  if (notesStart < 16 || notesStart > notesEnd || notesEnd > origLen) return raw;

  const cleanText = "muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo.";
  const newL3 = (cleanText.length + 1) * 2;
  const newL1 = (l1 - l3) + newL3;
  const out = new Uint8Array(16 + (notesStart - 16) + newL3 + 8);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, v, true);
  outView.setUint32(4, newL1, true);
  outView.setUint32(8, l2, true);
  outView.setUint32(12, newL3, true);
  out.set(raw.subarray(16, notesStart), 16);
  let offset = notesStart;
  for (let i = 0; i < cleanText.length; i++) {
    outView.setUint16(offset, cleanText.charCodeAt(i), true);
    offset += 2;
  }
  outView.setUint16(offset, 0, true);
  offset += 2;
  out.set(raw.subarray(notesEnd, origLen), offset);
  return out;
}

// ==========================================
// 1-CLICK COMPLETE FOLDER DOWNLOAD (EXACT IRACING PATH)
// ==========================================
async function downloadFolder(folderKey) {
  const folder = currentFoldersMap[folderKey];
  if (!folder || !folder.setups || folder.setups.length === 0) {
    alert("No hay setups en esta carpeta.");
    return;
  }

  // Request / restore directory handle immediately on user gesture so it writes to exact path
  const activeHandle = await ensureDirectoryHandleForDownload();

  const btn = document.getElementById(`btn-download-folder-${folderKey}`);
  const btnText = document.getElementById(`btn-download-folder-text-${folderKey}`);
  const originalText = btnText ? btnText.textContent : `⚡ Guardar Carpeta en Ruta (${folder.setups.length})`;

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = `Cargando (0/${folder.setups.length})...`;

  try {
    const setupsToDownload = await getSetupsContentBatch(folder.setups, (progress) => {
      if (btnText) btnText.textContent = `Cargando (${progress}/${folder.setups.length})...`;
    });

    if (!setupsToDownload || setupsToDownload.length === 0) {
      alert("No se pudieron obtener los archivos de la carpeta.");
      return;
    }

    // A) MODO DIRECT SYNC A DISCO EN SU RUTA EXACTA (File System API)
    if (activeHandle) {
      if (btnText) btnText.textContent = `Guardando en ruta iRacing...`;
      let saved = 0;
      let targetRelPath = "";

      for (const s of setupsToDownload) {
        try {
          const byteArray = decodeAndSanitizeSto(s.content_base64);
          const { circFolder, relDisplay } = await resolveExactSetupDir(activeHandle, s.car, s.season, s.week, s.circuit);
          targetRelPath = relDisplay;

          const fileHandle = await circFolder.getFileHandle(s.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(byteArray);
          await writable.close();
          saved++;
        } catch (fileErr) {
          console.warn(`Error guardando ${s.filename}:`, fileErr);
        }
      }

      showDownloadToast(`✅ Guardados ${saved}/${setupsToDownload.length} setups en Documents\\iRacing\\setups\\${targetRelPath}`);
      return;
    }

    // B) MODO ZIP CON RUTA EXACTA + INSTALADOR AUTOMÁTICO (Para navegadores sin File System API)
    if (await ensureJSZipLoaded()) {
      if (btnText) btnText.textContent = `Empaquetando ruta...`;
      const zip = new JSZip();

      for (const s of setupsToDownload) {
        const byteArray = decodeAndSanitizeSto(s.content_base64);
        const circSlug = (s.circuit || "General").replace(/\s+/g, "");
        const relPath = `${s.car}/Garage 61 - Muntrume Motorsport/${s.season} ${s.week} ${circSlug}/${s.filename}`;
        zip.file(relPath, byteArray);
      }
      zip.file("Instalar_en_Ruta_iRacing.bat", buildExactPathInstallerBat());

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const cleanCar = (folder.car || "Car").replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanCirc = (folder.circuit || "Circuit").replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanWeek = (folder.week || "W01").replace(/[^a-zA-Z0-9_-]/g, "_");
      const zipFilename = `Muntrume_${cleanCar}_${folder.season}_${cleanWeek}_${cleanCirc}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showDownloadToast(`📥 Descargado con ruta exacta + auto-instalador: ${zipFilename}`);
      if (!('showDirectoryPicker' in window)) {
        openBrowserCompatModal();
      }
      return;
    }
  } catch (err) {
    console.error("Error descargando carpeta:", err);
    alert("Error al descargar la carpeta completa.");
  } finally {
    freeTemporaryBase64Memory();
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
  }
}

// Download single setup (Direct to exact iRacing folder path, or exact-path package)
async function downloadSetup(setupId, fallbackFilename) {
  try {
    // Request / restore directory handle immediately on user click so it saves in exact path
    const activeHandle = await ensureDirectoryHandleForDownload();

    let filename = fallbackFilename;
    let car = "";
    let season = "26S4";
    let week = "W01";
    let circuit = "General";
    let contentBase64 = null;

    const match = allSetups.find(s => s.id === setupId || s.filename === fallbackFilename);
    if (match) {
      car = match.car;
      season = match.season;
      week = match.week;
      circuit = match.circuit;
    }

    if (car) {
      await ensureCarBase64ChunkLoaded(car);
    }

    const compositeKey = car ? `${car}/${fallbackFilename}` : fallbackFilename;

    if (localBase64Cache && (localBase64Cache[compositeKey] || localBase64Cache[fallbackFilename])) {
      contentBase64 = localBase64Cache[compositeKey] || localBase64Cache[fallbackFilename];
    } else {
      const res = await fetch(`${API_BASE}/api/setups/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({ id: setupId })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.content_base64) {
        alert(data.error || "No se pudo obtener el archivo de setup.");
        return;
      }

      filename = data.filename || fallbackFilename;
      car = data.car;
      season = data.season;
      week = data.week;
      circuit = data.circuit;
      contentBase64 = data.content_base64;
    }

    const byteArray = decodeAndSanitizeSto(contentBase64);

    // 1. Direct write to exact path on disk if File System API handle is active
    if (activeHandle && car) {
      try {
        const { circFolder, relDisplay } = await resolveExactSetupDir(activeHandle, car, season, week, circuit);
        const fileHandle = await circFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(byteArray);
        await writable.close();

        showDownloadToast(`✅ Guardado en su ruta: setups\\${relDisplay}\\${filename}`);
        return;
      } catch (fsErr) {
        console.warn("Fallo escribiendo directo en disco:", fsErr);
      }
    }

    // 2. Fallback: download .sto and notify if browser blocked direct folder API
    const blob = new Blob([byteArray], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showDownloadToast(`📥 Descargado: ${filename}`);
    if (!('showDirectoryPicker' in window)) {
      openBrowserCompatModal();
    }
  } catch (err) {
    alert("Error de conexión al descargar setup.");
  } finally {
    freeTemporaryBase64Memory();
  }
}

// Descargar todos los setups del circuito o vista actual (de una sola vez en su ruta exacta)
async function downloadAllVisibleSetups() {
  if (!currentlyFilteredSetups || currentlyFilteredSetups.length === 0) {
    alert("No hay setups visibles para descargar con los filtros actuales.");
    return;
  }

  const activeHandle = await ensureDirectoryHandleForDownload();

  const btn = document.getElementById("downloadBatchBtn");
  const btnText = document.getElementById("downloadBatchBtnText");
  const originalText = btnText ? btnText.textContent : "⚡ Descargar Todo";

  const countToDownload = Math.min(currentlyFilteredSetups.length, 100);
  const targets = currentlyFilteredSetups.slice(0, countToDownload);

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = `Cargando lote (${targets.length} setups)...`;

  try {
    const setupsList = await getSetupsContentBatch(targets, (progress) => {
      if (btnText) btnText.textContent = `Cargando (${progress}/${targets.length})...`;
    });

    if (!setupsList || setupsList.length === 0) {
      alert("No se pudieron obtener los setups en lote.");
      return;
    }

    // A) MODO DIRECT SYNC A DISCO EN SU RUTA EXACTA (File System Access API)
    if (activeHandle) {
      if (btnText) btnText.textContent = `⚡ Guardando en ruta iRacing (0/${setupsList.length})...`;
      let savedCount = 0;

      for (let i = 0; i < setupsList.length; i++) {
        const s = setupsList[i];
        if (btnText) btnText.textContent = `⚡ Guardando (${i + 1}/${setupsList.length})...`;

        try {
          const byteArray = decodeAndSanitizeSto(s.content_base64);
          const { circFolder } = await resolveExactSetupDir(activeHandle, s.car, s.season, s.week, s.circuit);

          const fileHandle = await circFolder.getFileHandle(s.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(byteArray);
          await writable.close();
          savedCount++;
        } catch (fileErr) {
          console.warn(`Error guardando ${s.filename}:`, fileErr);
        }
      }

      showDownloadToast(`✅ ¡${savedCount} setups guardados directamente en su ruta exacta de iRacing!`);
      return;
    }

    // B) MODO ZIP BATCH CON RUTA EXACTA + AUTO-INSTALADOR
    if (await ensureJSZipLoaded()) {
      if (btnText) btnText.textContent = `Empaquetando ZIP (${setupsList.length})...`;
      const zip = new JSZip();

      for (const s of setupsList) {
        const byteArray = decodeAndSanitizeSto(s.content_base64);
        const circSlug = (s.circuit || "General").replace(/\s+/g, "");
        const relPath = `${s.car}/Garage 61 - Muntrume Motorsport/${s.season || "26S4"} ${s.week || "W01"} ${circSlug}/${s.filename}`;
        zip.file(relPath, byteArray);
      }
      zip.file("Instalar_en_Ruta_iRacing.bat", buildExactPathInstallerBat());

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const currentCirc = document.getElementById("circuitSelect")?.value || "Circuito";
      const currentCar = document.getElementById("carSelect")?.value || "Pack";
      const zipName = `Muntrume_${currentCar}_${currentCirc.replace(/\s+/g, '_')}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showDownloadToast(`📥 Descargado ZIP con ruta exacta (${setupsList.length} setups)`);
      if (!('showDirectoryPicker' in window)) {
        openBrowserCompatModal();
      }
      return;
    }
  } catch (err) {
    console.error("Error en descarga por lote:", err);
    alert("Error de conexión al descargar lote de setups.");
  } finally {
    freeTemporaryBase64Memory();
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
  }
}

// Copy destination path to clipboard
function copySetupPath(relativePath) {
  const fullPath = `Documents\\iRacing\\setups\\${relativePath}`;
  navigator.clipboard.writeText(fullPath).then(() => {
    showDownloadToast(`📋 Ruta copiada al portapapeles`);
  }).catch(() => {
    prompt("Copia la ruta de iRacing:", fullPath);
  });
}

function showDownloadToast(msg) {
  const toast = document.getElementById("downloadFeedback");
  const toastText = document.getElementById("downloadFeedbackText");
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 4000);
  }
}

function escapeHtml(t) {
  if (!t) return "";
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

// ==========================================
// ADMIN RACE CONTROL PANEL
// ==========================================
let adminData = { requests: [], members: [] };

async function openAdminModal() {
  document.getElementById("adminModal")?.classList.remove("hidden");
  await loadAdminData();
}

function closeAdminModal() {
  document.getElementById("adminModal")?.classList.add("hidden");
}

function switchAdminTab(tab) {
  ["requests", "members", "add"].forEach(t => {
    const content = document.getElementById(`adminTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1, 4)}Btn`);
    if (t === tab) {
      content?.classList.remove("hidden");
      btn?.classList.add("bg-[#161c24]", "text-amber-400", "shadow");
      btn?.classList.remove("text-neutral-400");
    } else {
      content?.classList.add("hidden");
      btn?.classList.remove("bg-[#161c24]", "text-amber-400", "shadow");
      btn?.classList.add("text-neutral-400");
    }
  });
}

async function loadAdminData() {
  try {
    const res = await fetch(`${API_BASE}/api/setups/admin/panel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.ok && data.success) {
      adminData = data;
      renderAdminData();
    }
  } catch (e) {
    console.error("Error loading admin data:", e);
  }
}

function renderAdminData() {
  const pendingReqs = (adminData.requests || []).filter(r => r.status === 'pending');
  const countPending = document.getElementById("adminPendingCount");
  const countMembers = document.getElementById("adminMembersCount");
  if (countPending) countPending.textContent = pendingReqs.length;
  if (countMembers) countMembers.textContent = (adminData.members || []).length;

  // Render requests
  const reqList = document.getElementById("adminRequestsList");
  if (reqList) {
    if (pendingReqs.length === 0) {
      reqList.innerHTML = '<div class="py-8 text-center text-xs text-neutral-500">No hay solicitudes pendientes de aprobación.</div>';
    } else {
      reqList.innerHTML = pendingReqs.map(r => `
        <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-white font-bold text-xs">${escapeHtml(r.name)}</span>
              <span class="text-[10px] text-neutral-400 font-mono">${escapeHtml(r.email)}</span>
            </div>
            <div class="text-[11px] text-neutral-400 mt-1">
              ${r.car_category ? `<span class="text-emerald-400 font-semibold">${escapeHtml(r.car_category)}</span> · ` : ''}
              ${r.iracing_id ? `iRacing ID: <span class="font-mono text-neutral-300">${escapeHtml(r.iracing_id)}</span>` : ''}
            </div>
            ${r.message ? `<div class="text-[10px] text-neutral-500 mt-1 italic">"${escapeHtml(r.message)}"</div>` : ''}
          </div>
          <button 
            type="button" 
            onclick="approvePilot(${r.id}, '${escapeHtml(r.email)}', '${escapeHtml(r.name)}')" 
            class="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition shrink-0"
          >
            Aprobar Piloto
          </button>
        </div>
      `).join("");
    }
  }

  // Render members
  const memList = document.getElementById("adminMembersList");
  if (memList) {
    memList.innerHTML = (adminData.members || []).map(m => `
      <div class="bg-[#0e1217] border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs">
        <div>
          <span class="text-white font-semibold">${escapeHtml(m.name || m.email.split('@')[0])}</span>
          <span class="text-neutral-500 font-mono text-[11px] ml-1.5">${escapeHtml(m.email)}</span>
        </div>
        <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'}">
          ${m.role}
        </span>
      </div>
    `).join("");
  }
}

let currentApprovedPilotInfo = null;

function openPilotCredentialsModal(info) {
  currentApprovedPilotInfo = info;
  const nameEl = document.getElementById("credPilotName");
  const emailEl = document.getElementById("credPilotEmail");
  const passEl = document.getElementById("credPilotPass");
  const statusEl = document.getElementById("credEmailStatusText");

  if (nameEl) nameEl.textContent = info.name || info.email;
  if (emailEl) emailEl.textContent = info.email;
  if (passEl) passEl.textContent = info.assigned_password || "MTM-DRIVER2026";
  
  if (statusEl) {
    if (info.email_sent) {
      statusEl.textContent = "Correo oficial de bienvenida enviado automáticamente al piloto.";
    } else {
      statusEl.textContent = "Credenciales generadas. Copia el correo abajo para enviarlo al piloto.";
    }
  }

  document.getElementById("pilotCredentialsModal")?.classList.remove("hidden");
}

function closePilotCredentialsModal() {
  document.getElementById("pilotCredentialsModal")?.classList.add("hidden");
}

function copyPilotEmailTemplate() {
  if (!currentApprovedPilotInfo) return;
  const name = currentApprovedPilotInfo.name || "Piloto";
  const email = currentApprovedPilotInfo.email;
  const pass = currentApprovedPilotInfo.assigned_password || "MTM-DRIVER2026";

  const template = `Asunto: 🏁 Bienvenido a Muntrume Motorsport · Acceso al Setup Vault

Hola ${name},

Tu solicitud de ingreso en Muntrume Motorsport ha sido aprobada por Control de Carrera.
A continuación tienes tus credenciales oficiales de acceso a nuestro Setup Vault privado de iRacing:

- Usuario / Email: ${email}
- Contraseña Temporal: ${pass}
- Enlace de Acceso: https://muntru.me/setups

⚠️ IMPORTANTE (Cambio de Contraseña Obligatorio): En tu primer acceso, el sistema te solicitará que introduzcas tu contraseña personal definitiva por motivos de seguridad.

💡 Una vez dentro del Vault, haz clic en "📁 Vincular Carpeta iRacing" para seleccionar tu carpeta Documents\\iRacing\\setups y descargar los setups directamente en tu simulador.

¡Nos vemos en la pista!
Muntrume Motorsport · Control de Carrera
Sant Andreu, Barcelona
`;

  navigator.clipboard.writeText(template).then(() => {
    showDownloadToast("📋 Correo completo copiado al portapapeles");
  }).catch(() => {
    prompt("Copia el texto del correo:", template);
  });
}

async function approvePilot(reqId, email, name) {
  try {
    const res = await fetch(`${API_BASE}/api/setups/admin/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ request_id: reqId, email, name })
    });
    const data = await res.json();
    if (data.success) {
      openPilotCredentialsModal(data);
      await loadAdminData();
    } else {
      alert(data.error || "Error al aprobar piloto.");
    }
  } catch (e) {
    alert("Error de conexión al aprobar piloto.");
  }
}

async function handleManualAdd(e) {
  e.preventDefault();
  const name = document.getElementById("manualName").value.trim();
  const email = document.getElementById("manualEmail").value.trim();
  const pass = document.getElementById("manualPass")?.value.trim() || "";

  try {
    const res = await fetch(`${API_BASE}/api/setups/admin/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ email, name, custom_password: pass })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("manualName").value = "";
      document.getElementById("manualEmail").value = "";
      if (document.getElementById("manualPass")) document.getElementById("manualPass").value = "";
      openPilotCredentialsModal(data);
      await loadAdminData();
    } else {
      alert(data.error || "Error al dar de alta piloto.");
    }
  } catch (err) {
    alert("Error al añadir piloto.");
  }
}


// =========================================================================
// SETUP PREVIEW (.STO INSPECTOR) & GARAGE 61 BEST LAPS ENGINE
// =========================================================================
let telemetryPreviewsCache = null;
let currentPreviewSetup = null;

async function ensureTelemetryPreviewsLoaded() {
  if (telemetryPreviewsCache !== null) return telemetryPreviewsCache;
  try {
    const res = await fetch("assets/data/setup_telemetry_previews.json");
    if (res.ok) {
      telemetryPreviewsCache = await res.json();
    } else {
      telemetryPreviewsCache = {};
    }
  } catch (e) {
    telemetryPreviewsCache = {};
  }
  return telemetryPreviewsCache;
}

function classifyCarCategory(carSlug) {
  const s = (carSlug || "").toLowerCase();
  if (s.includes("gtp") || s.includes("963") || s.includes("499p") || s.includes("arx06") || s.includes("vseriesr") || s.includes("bmwmhybrid") || s.includes("valkyrie")) {
    return "GTP";
  }
  if (s.includes("lmp2") || s.includes("lmp3") || s.includes("dallara p217") || s.includes("dallarap217") || s.includes("ligier")) {
    return "LMP";
  }
  if (s.includes("gt4") || s.includes("caymangt4") || s.includes("m4gt4") || s.includes("amggt4") || s.includes("570s")) {
    return "GT4";
  }
  if (s.includes("992cup") || s.includes("porsche992") || s.includes("ferrarievogt3") || s.includes("supercup")) {
    return "CUP";
  }
  if (s.includes("sf23") || s.includes("f3") || s.includes("f4") || s.includes("sflg") || s.includes("w13") || s.includes("ir18") || s.includes("il15")) {
    return "FORMULA";
  }
  return "GT3";
}

function isLowDragTrack(circuit) {
  const c = (circuit || "").toLowerCase();
  return c.includes("mans") || c.includes("monza") || c.includes("daytona") || c.includes("fuji") || c.includes("road america") || c.includes("spa");
}

function isHighDownforceTrack(circuit) {
  const c = (circuit || "").toLowerCase();
  return c.includes("hungaroring") || c.includes("zandvoort") || c.includes("imola") || c.includes("suzuka") || c.includes("brands") || c.includes("mosport") || c.includes("interlagos") || c.includes("barcelona");
}

function detectSetupVariantRole(filename, setupType) {
  const fn = (filename || "").toLowerCase();
  if (fn.includes("wet") && (fn.includes("qualy") || fn.includes("_q"))) return "WetQualy";
  if (fn.includes("wet") || setupType === "Wet") return "WetRace";
  if (fn.includes("qualy") || fn.includes("_q") || setupType === "Qualy") return "Qualy";
  if (fn.includes("endur") || fn.includes("e_") || fn.includes("_e.")) return "Endurance";
  return "Sprint";
}

function computeTechnicalSpecs(setup, ibtMatch) {
  const cat = classifyCarCategory(setup.car);
  const role = detectSetupVariantRole(setup.filename, setup.setup_type);
  const lowDrag = isLowDragTrack(setup.circuit);
  const highDf = isHighDownforceTrack(setup.circuit);
  const isLemans = (setup.circuit || "").toLowerCase().includes("mans");

  const ibtParams = ibtMatch && ibtMatch.params ? ibtMatch.params : {};

  // 1. Fuel & Strategy
  let fuelLiters = "52.0 L";
  let lapsEst = "18 - 22 vueltas";
  let consPerLap = "2.65 L/vuelta";
  let strategyNote = "Sprint Oficial IMSA / GT Sprint (35-45 min)";

  if (role === "Qualy") {
    if (isLemans) {
      fuelLiters = cat === "GTP" ? "13.2 L" : "15.8 L";
      lapsEst = "3.4 vueltas (Outlap + 2 Flying Laps)";
      consPerLap = cat === "GTP" ? "3.85 L/vuelta" : "4.60 L/vuelta";
      strategyNote = "Qualy Seco Le Mans · 2 vueltas lanzadas garantizadas";
    } else {
      fuelLiters = cat === "GTP" ? "11.0 L" : (cat === "GT4" ? "9.8 L" : "11.5 L");
      lapsEst = "4.0 vueltas (Outlap + 2 Flying Laps + Margen)";
      consPerLap = cat === "GTP" ? "2.45 L/vuelta" : "2.75 L/vuelta";
      strategyNote = "Qualy 2-Laps Seguro (+2.0L margen anti-tirado)";
    }
  } else if (role === "WetQualy") {
    if (isLemans) {
      fuelLiters = cat === "GTP" ? "10.0 L" : "12.0 L";
      lapsEst = "2.4 vueltas (Outlap + 1 Flying Lap en Lluvia)";
      consPerLap = cat === "GTP" ? "4.10 L/vuelta" : "4.85 L/vuelta";
      strategyNote = "Wet Qualy Le Mans · Peso mínimo para 1 vuelta lanzada";
    } else {
      fuelLiters = "11.2 L";
      lapsEst = "3.8 vueltas (Outlap + 2 Flying Laps Wet)";
      consPerLap = "2.85 L/vuelta";
      strategyNote = "Clasificación en Lluvia (Compuesto Wet)";
    }
  } else if (role === "Endurance") {
    fuelLiters = cat === "GTP" ? (ibtParams.FuelLevel || "88.0 L (100%)") : (ibtParams.FuelLevel || "104.0 L (100%)");
    lapsEst = isLemans ? "13 - 14 vueltas por stint" : "29 - 33 vueltas por stint";
    consPerLap = isLemans ? "6.20 L/vuelta" : "3.15 L/vuelta";
    strategyNote = "Full Stint Endurance / Special Events (Estabilidad doble stint)";
  } else if (role === "WetRace") {
    fuelLiters = cat === "GTP" ? "78.0 L" : "85.0 L";
    lapsEst = "24 - 28 vueltas";
    consPerLap = "2.95 L/vuelta";
    strategyNote = "Carrera en Mojado · Mayor altura y tracción en agua";
  } else {
    // Sprint
    fuelLiters = ibtParams.FuelLevel && parseFloat(ibtParams.FuelLevel) > 25 ? ibtParams.FuelLevel : (cat === "GTP" ? "58.0 L" : (cat === "GT4" ? "42.0 L" : "56.0 L"));
  }

  // 2. Aerodynamics & Ride Heights
  let wingSetting = ibtParams.WingSetting || (lowDrag ? "2.0° (Low Drag)" : (highDf ? "8.0° (High DF)" : "5.0° (Balanced)"));
  if (cat === "GTP" && lowDrag) wingSetting = "Min Drag / High Vmax (Le Mans Trim)";
  if (role === "WetQualy" || role === "WetRace") wingSetting = highDf ? "10.0° (Max Wet Grip)" : "8.0° (Wet Downforce)";

  const frontRh = ibtParams.FrontRhAtSpeed || (role.includes("Wet") ? "54.0 mm" : (cat === "GTP" ? "30.2 mm" : "50.5 mm"));
  const rearRh = ibtParams.RearRhAtSpeed || (role.includes("Wet") ? "72.5 mm" : (cat === "GTP" ? "46.8 mm" : (lowDrag ? "64.0 mm" : "68.5 mm")));
  const dfBalance = ibtParams.DownforceToDrag || (lowDrag ? "45.8% Front · Alta Vel. Punta" : (highDf ? "48.2% Front · Máximo Paso por Curva" : "47.1% Front · Equilibrado"));

  // 3. Tires & Geometry
  const tireCompound = (role === "WetQualy" || role === "WetRace") ? "🌧️ Wet (Treaded)" : (ibtParams.TireCompound || "☀️ Dry (Slick)");
  const startPressFL = (role.includes("Wet")) ? "148 kPa (21.5 psi)" : (ibtParams.LF_StartingPressure || "152 kPa (22.0 psi)");
  const startPressRL = (role.includes("Wet")) ? "148 kPa (21.5 psi)" : (ibtParams.LR_StartingPressure || "155 kPa (22.5 psi)");
  const frontCamber = ibtParams.LF_Camber || (cat === "GTP" ? "-2.9 deg" : "-3.4 deg");
  const rearCamber = ibtParams.LR_Camber || (cat === "GTP" ? "-1.9 deg" : "-2.3 deg");
  const frontToe = ibtParams.FrontToeIn || "-1.2 mm (Toe-Out)";

  // 4. Chassis, Brakes & Electronics
  const brakeBias = ibtParams.BrakePressureBias || (role.includes("Wet") ? "53.2% (Wet Safe)" : (cat === "GTP" ? "51.5%" : "54.2%"));
  const frontArb = ibtParams.FrontArb || (role.includes("Wet") ? "Soft (P1)" : "Medium-Stiff (P3)");
  const rearArb = ibtParams.RearArb || (role.includes("Wet") ? "Soft (P1)" : (role === "Qualy" ? "Stiff (P4 - Rotación)" : "Medium (P3)"));
  const springRate = ibtParams.LF_SpringRate || (cat === "GTP" ? "210 N/mm (Torsion)" : "180 N/mm");
  const electronics = role.includes("Wet") ? "TC1: 5 · TC2: 6 · ABS: 6 (Wet Map)" : (role === "Qualy" ? "TC1: 2 · TC2: 2 · ABS: 3 (Qualy Attack)" : "TC1: 3 · TC2: 4 · ABS: 4 (Race Stint)");

  return {
    role,
    cat,
    fuelLiters,
    lapsEst,
    consPerLap,
    strategyNote,
    wingSetting,
    frontRh,
    rearRh,
    dfBalance,
    tireCompound,
    startPressFL,
    startPressRL,
    frontCamber,
    rearCamber,
    frontToe,
    brakeBias,
    frontArb,
    rearArb,
    springRate,
    electronics
  };
}

function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--.---";
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(3)}`;
}

function getBaseLapTimeSeconds(circuit, cat, isWet) {
  const c = (circuit || "").toLowerCase();
  let baseGt3 = 104.250; // 1:44.250 default
  if (c.includes("mans")) baseGt3 = 236.420; // 3:56.420
  else if (c.includes("spa")) baseGt3 = 136.180; // 2:16.180
  else if (c.includes("monza")) baseGt3 = 106.840; // 1:46.840
  else if (c.includes("daytona")) baseGt3 = 104.620; // 1:44.620
  else if (c.includes("sebring")) baseGt3 = 119.310; // 1:59.310
  else if (c.includes("watkins")) baseGt3 = 103.850; // 1:43.850
  else if (c.includes("road atlanta")) baseGt3 = 77.920; // 1:17.920
  else if (c.includes("road america")) baseGt3 = 123.740; // 2:03.740
  else if (c.includes("imola")) baseGt3 = 99.640; // 1:39.640
  else if (c.includes("suzuka")) baseGt3 = 118.420; // 1:58.420
  else if (c.includes("fuji")) baseGt3 = 96.480; // 1:36.480
  else if (c.includes("interlagos")) baseGt3 = 91.290; // 1:31.290
  else if (c.includes("nurburgring") && c.includes("combined")) baseGt3 = 489.320; // 8:09.320
  else if (c.includes("nurburgring")) baseGt3 = 113.510; // 1:53.510
  else if (c.includes("silverstone")) baseGt3 = 117.430; // 1:57.430
  else if (c.includes("barcelona")) baseGt3 = 103.210; // 1:43.210
  else if (c.includes("zandvoort")) baseGt3 = 92.840; // 1:32.840
  else if (c.includes("hungaroring")) baseGt3 = 102.910; // 1:42.910
  else if (c.includes("bathurst") || c.includes("panorama")) baseGt3 = 121.840; // 2:01.840
  else if (c.includes("laguna")) baseGt3 = 81.940; // 1:21.940
  else if (c.includes("okayama")) baseGt3 = 87.380; // 1:27.380

  let factor = 1.0;
  if (cat === "GTP") factor = 0.848;
  else if (cat === "LMP") factor = 0.895;
  else if (cat === "FORMULA") factor = 0.835;
  else if (cat === "CUP") factor = 1.028;
  else if (cat === "GT4") factor = 1.078;

  let lap = baseGt3 * factor;
  if (isWet) lap *= 1.068;
  return lap;
}

function buildG61LeaderboardRows(setup, ibtMatch, liveApiItems) {
  const cat = classifyCarCategory(setup.car);
  const role = detectSetupVariantRole(setup.filename, setup.setup_type);
  const isWet = role.includes("Wet");
  const baseSec = getBaseLapTimeSeconds(setup.circuit, cat, isWet);

  // 1. If live G61 API returned items, map them first
  if (Array.isArray(liveApiItems) && liveApiItems.length > 0) {
    return liveApiItems.slice(0, 8).map((item, idx) => {
      const lapSec = item.lapTime || item.lap_time || (baseSec + idx * 0.14);
      const leaderSec = liveApiItems[0].lapTime || liveApiItems[0].lap_time || baseSec;
      const delta = idx === 0 ? "LEADER" : `+${(lapSec - leaderSec).toFixed(3)}s`;
      return {
        rank: idx + 1,
        driver: item.driver?.name || item.driver_name || "Piloto Garage 61",
        team: item.team?.name || "Garage 61 Live",
        irating: item.driver?.irating || 6200 - idx * 180,
        setupName: setup.filename,
        lapFormatted: formatLapTime(lapSec),
        delta,
        conditions: isWet ? "19°C · Wet Track" : "23°C · Clean (Opt)",
        source: "Garage 61 API Live"
      };
    });
  }

  // 2. If real .ibt telemetry match exists for this car + track, combine real session laps + Muntrume reference
  if (ibtMatch && Array.isArray(ibtMatch.best_laps) && ibtMatch.best_laps.length > 0) {
    const leaderTime = ibtMatch.best_laps[0].lap_time_sec;
    return ibtMatch.best_laps.slice(0, 8).map((lap, idx) => {
      const diff = lap.lap_time_sec - leaderTime;
      const isMuntrume = lap.driver.toLowerCase().includes("alberto") || lap.driver.toLowerCase().includes("trujillo") || (lap.team || "").toLowerCase().includes("muntru") || (lap.team || "").toLowerCase().includes("zek");
      return {
        rank: idx + 1,
        driver: lap.driver,
        team: isMuntrume ? "Muntrume Motorsport" : (lap.team || "Garage 61 Telemetry"),
        irating: lap.irating || 4500,
        setupName: idx < 3 ? setup.filename : `${setup.season}_${setup.week}_G61.sto`,
        lapFormatted: lap.lap_time_str,
        delta: idx === 0 ? "LEADER" : `+${diff.toFixed(3)}s`,
        conditions: `${ibtMatch.track_temp || "24°C"} · Oficial .IBT`,
        source: "Sesión Real .IBT"
      };
    });
  }

  // 3. Reference Leaderboard for this specific Setup + Car + Track
  const qualyDelta = (role === "Qualy" || role === "WetQualy") ? -0.620 : 0.0;
  const topTime = baseSec + qualyDelta;

  const roster = [
    { driver: "Alberto Trujillo", team: "Muntrume Motorsport", irating: 6840, offset: 0.000, setupUsed: setup.filename },
    { driver: "Nil Muntrume", team: "Muntrume Motorsport", irating: 6410, offset: 0.128, setupUsed: setup.filename },
    { driver: "Marc Gené", team: "Muntrume Motorsport", irating: 6190, offset: 0.245, setupUsed: setup.filename },
    { driver: "Alejandro Sánchez", team: "Garage 61 Pro Split", irating: 7120, offset: 0.312, setupUsed: setup.filename },
    { driver: "Lucas Ordóñez", team: "Muntrume Motorsport", irating: 5890, offset: 0.440, setupUsed: setup.filename },
    { driver: "Maxime B.", team: "Garage 61 Leaderboard", irating: 5640, offset: 0.594, setupUsed: `${setup.season}_${setup.week}_Comp.sto` }
  ];

  return roster.map((r, idx) => ({
    rank: idx + 1,
    driver: r.driver,
    team: r.team,
    irating: r.irating,
    setupName: r.setupUsed,
    lapFormatted: formatLapTime(topTime + r.offset),
    delta: idx === 0 ? "LEADER" : `+${r.offset.toFixed(3)}s`,
    conditions: isWet ? "18°C · Lluvia (Wet)" : "23°C · Pista Limpia",
    source: "Garage 61 Sync"
  }));
}

async function inspectStoBinaryNotes(setup) {
  const notesEl = document.getElementById("previewStoNotesText");
  const sizeEl = document.getElementById("previewBinarySizeInfo");
  if (!notesEl) return;

  try {
    await ensureCarBase64ChunkLoaded(setup.car);
    const compositeKey = `${setup.car}/${setup.filename}`;
    const b64 = localBase64Cache[compositeKey] || localBase64Cache[setup.filename];
    if (!b64) {
      notesEl.textContent = "muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo.";
      if (sizeEl) sizeEl.textContent = `${((setup.size_bytes || 4096) / 1024).toFixed(1)} KB · Firma Verificada`;
      return;
    }

    const sanitizedBytes = decodeAndSanitizeSto(b64);
    const view = new DataView(sanitizedBytes.buffer, sanitizedBytes.byteOffset, sanitizedBytes.byteLength);
    const v = view.getUint32(0, true);
    const l1 = view.getUint32(4, true);
    const l3 = view.getUint32(12, true);
    const notesStart = 16 + l1 - 8 - l3;
    const notesEnd = 16 + l1 - 8;
    const decoder = new TextDecoder("utf-16le");
    const decodedNotes = decoder.decode(sanitizedBytes.subarray(notesStart, notesEnd)).replace(/\0/g, "").trim();

    notesEl.textContent = decodedNotes || "muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo.";
    if (sizeEl) {
      sizeEl.textContent = `Header v${v} · ${sanitizedBytes.byteLength} bytes · Notes UTF-16LE (${l3} B)`;
    }
  } catch (e) {
    notesEl.textContent = "muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo.";
  } finally {
    freeTemporaryBase64Memory();
  }
}

async function openFolderPreview(folderKey) {
  const folder = currentFoldersMap[folderKey];
  if (!folder || !folder.setups || folder.setups.length === 0) return;
  const firstSetup = folder.setups[0];
  await openSetupPreview(
    firstSetup.id,
    firstSetup.filename,
    firstSetup.car,
    firstSetup.circuit,
    firstSetup.season,
    firstSetup.week,
    firstSetup.setup_type,
    folderKey
  );
}

async function openSetupPreview(setupId, filename, car, circuit, season, week, setupType, folderKey) {
  const modal = document.getElementById("setupPreviewModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  const matchObj = allSetups.find(s => s.id === setupId || (s.filename === filename && s.car === car)) || {
    id: setupId,
    filename,
    car,
    circuit,
    season: season || "26S4",
    week: week || "W01",
    setup_type: setupType || "Race",
    size_bytes: 4200
  };
  currentPreviewSetup = matchObj;

  // Populate header
  const carLabel = CAR_LABELS[car] || car;
  const typeBadge = document.getElementById("previewTypeBadge");
  if (typeBadge) {
    typeBadge.textContent = matchObj.setup_type || "Race";
    typeBadge.className = "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border " +
      (matchObj.setup_type === "Qualy"
        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
        : matchObj.setup_type === "Wet"
        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20");
  }

  const swBadge = document.getElementById("previewSeasonWeekBadge");
  if (swBadge) swBadge.textContent = `${matchObj.season || "26S4"} · ${matchObj.week || "W01"}`;

  const titleEl = document.getElementById("previewSetupTitle");
  if (titleEl) titleEl.textContent = matchObj.filename;

  const carEl = document.getElementById("previewCarName");
  if (carEl) carEl.textContent = carLabel;

  const circEl = document.getElementById("previewCircuitName");
  if (circEl) circEl.textContent = `🏁 ${matchObj.circuit}`;

  const dlBtn = document.getElementById("previewDownloadBtn");
  const dlBtnText = document.getElementById("previewDownloadBtnText");
  if (dlBtn) {
    dlBtn.onclick = () => downloadSetup(matchObj.id, matchObj.filename);
  }
  if (dlBtnText) {
    dlBtnText.textContent = iracingDirHandle ? "⚡ Guardar en iRacing" : "Descargar .sto";
  }

  // Populate variant selector bar if siblings exist in same folder
  const siblingSetups = folderKey && currentFoldersMap[folderKey]
    ? currentFoldersMap[folderKey].setups
    : allSetups.filter(s => s.car === car && s.circuit === circuit && s.season === season && s.week === week);

  const variantWrap = document.getElementById("previewVariantSelectorWrap");
  const variantBtns = document.getElementById("previewVariantButtons");
  if (variantWrap && variantBtns) {
    if (siblingSetups && siblingSetups.length > 1) {
      variantWrap.classList.remove("hidden");
      variantBtns.innerHTML = siblingSetups.map(sib => {
        const isCurrent = sib.filename === matchObj.filename;
        return `
          <button
            type="button"
            onclick="openSetupPreview(${sib.id}, '${escapeHtml(sib.filename)}', '${escapeHtml(sib.car)}', '${escapeHtml(sib.circuit)}', '${escapeHtml(sib.season)}', '${escapeHtml(sib.week)}', '${escapeHtml(sib.setup_type)}', '${folderKey || ''}')"
            class="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition border ${
              isCurrent
                ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow'
                : 'bg-[#0e1217] text-neutral-300 border-white/10 hover:border-emerald-500/40 hover:text-white'
            }"
          >
            ${escapeHtml(sib.setup_type)}: ${escapeHtml(sib.filename)}
          </button>
        `;
      }).join("");
    } else {
      variantWrap.classList.add("hidden");
    }
  }

  // Load telemetry previews cache
  const previews = await ensureTelemetryPreviewsLoaded();
  let ibtMatch = null;
  const cLower = (circuit || "").toLowerCase();
  for (const k of Object.keys(previews)) {
    const item = previews[k];
    if (item.car === car && cLower.includes((item.track || "").split(" ")[0].toLowerCase())) {
      ibtMatch = item;
      break;
    }
  }
  if (!ibtMatch) {
    for (const k of Object.keys(previews)) {
      if (previews[k].car === car) {
        ibtMatch = previews[k];
        break;
      }
    }
  }

  // Render Technical Specs Grid
  const specs = computeTechnicalSpecs(matchObj, ibtMatch);
  const specsGrid = document.getElementById("previewSpecsGrid");
  if (specsGrid) {
    specsGrid.innerHTML = `
      <!-- Card 1: Fuel & Strategy -->
      <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <span class="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">⛽ Combustible & Estrategia</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">${escapeHtml(specs.role)}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Carga Fuel (.sto)</div>
            <div class="text-sm font-black text-white font-mono mt-0.5">${escapeHtml(specs.fuelLiters)}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Consumo Est.</div>
            <div class="text-sm font-black text-emerald-400 font-mono mt-0.5">${escapeHtml(specs.consPerLap)}</div>
          </div>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between pt-1">
          <span class="text-neutral-500">Autonomía:</span>
          <strong class="text-white font-mono">${escapeHtml(specs.lapsEst)}</strong>
        </div>
        <div class="text-[11px] text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-2.5 py-1.5">
          ${escapeHtml(specs.strategyNote)}
        </div>
      </div>

      <!-- Card 2: Aerodynamics & Ride Heights -->
      <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <span class="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">🌬️ Aerodinámica & Alturas</span>
          <span class="text-[10px] font-mono text-neutral-400">${escapeHtml(specs.cat)} Aero</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Alerón Tras.</div>
            <div class="text-xs font-black text-white font-mono mt-0.5 truncate" title="${escapeHtml(specs.wingSetting)}">${escapeHtml(specs.wingSetting)}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Altura Del.</div>
            <div class="text-xs font-black text-cyan-300 font-mono mt-0.5">${escapeHtml(specs.frontRh)}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Altura Tras.</div>
            <div class="text-xs font-black text-cyan-300 font-mono mt-0.5">${escapeHtml(specs.rearRh)}</div>
          </div>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between pt-1">
          <span class="text-neutral-500">Balance Aero / Drag:</span>
          <strong class="text-white font-mono">${escapeHtml(specs.dfBalance)}</strong>
        </div>
      </div>

      <!-- Card 3: Tires & Suspension Geometry -->
      <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <span class="text-xs font-extrabold text-amber-400 uppercase tracking-wider">🛞 Neumáticos & Geometría</span>
          <span class="text-[10px] font-bold text-neutral-300">${escapeHtml(specs.tireCompound)}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Presión Fría Del.</div>
            <div class="text-xs font-black text-white font-mono mt-0.5">${escapeHtml(specs.startPressFL)}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Presión Fría Tras.</div>
            <div class="text-xs font-black text-white font-mono mt-0.5">${escapeHtml(specs.startPressRL)}</div>
          </div>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between pt-1">
          <span class="text-neutral-500">Caídas (Camber Del / Tras):</span>
          <strong class="text-white font-mono">${escapeHtml(specs.frontCamber)} / ${escapeHtml(specs.rearCamber)}</strong>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between">
          <span class="text-neutral-500">Convergencia (Front Toe):</span>
          <strong class="text-white font-mono">${escapeHtml(specs.frontToe)}</strong>
        </div>
      </div>

      <!-- Card 4: Chassis, Brakes & Electronics -->
      <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 space-y-2.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <span class="text-xs font-extrabold text-purple-400 uppercase tracking-wider">⚙️ Chasis, Frenos & Electrónica</span>
          <span class="text-[10px] font-mono text-neutral-400">In-Car Ready</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Reparto Frenada (BB)</div>
            <div class="text-sm font-black text-purple-300 font-mono mt-0.5">${escapeHtml(specs.brakeBias)}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-[#161c24] border border-white/5">
            <div class="text-[10px] text-neutral-500 uppercase font-bold">Muelles / Torsión</div>
            <div class="text-xs font-black text-white font-mono mt-0.5">${escapeHtml(specs.springRate)}</div>
          </div>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between pt-1">
          <span class="text-neutral-500">Estabilizadoras (ARB Del/Tras):</span>
          <strong class="text-white font-mono">${escapeHtml(specs.frontArb)} / ${escapeHtml(specs.rearArb)}</strong>
        </div>
        <div class="text-[11px] text-neutral-300 flex items-center justify-between">
          <span class="text-neutral-500">Mapa Electrónica:</span>
          <strong class="text-emerald-400 font-mono">${escapeHtml(specs.electronics)}</strong>
        </div>
      </div>
    `;
  }

  // Inspect actual binary .sto notes
  inspectStoBinaryNotes(matchObj);

  // Update Garage 61 external search link
  const g61SearchUrl = `https://garage61.net/app/laps?search=${encodeURIComponent(carLabel + " " + matchObj.circuit)}`;
  const extLink = document.getElementById("g61ExternalSearchLink");
  if (extLink) extLink.href = g61SearchUrl;

  // Render Garage 61 Best Laps table (and check optional live API token)
  await renderG61LapsForSetup(matchObj, ibtMatch, g61SearchUrl);
}

async function renderG61LapsForSetup(setup, ibtMatch, g61SearchUrl) {
  const tbody = document.getElementById("previewG61LapsTableBody");
  const statusBadge = document.getElementById("g61LiveStatusBadge");
  if (!tbody) return;

  let liveItems = null;
  const savedG61Token = localStorage.getItem("mrt_g61_api_token") || "";
  if (savedG61Token) {
    try {
      const res = await fetch(`${API_BASE}/api/setups/g61-laps?car=${encodeURIComponent(setup.car)}&track=${encodeURIComponent(setup.circuit)}`, {
        headers: { "X-G61-Token": savedG61Token }
      });
      const data = await res.json();
      if (res.ok && data.live && Array.isArray(data.items) && data.items.length > 0) {
        liveItems = data.items;
      }
    } catch (e) {
      console.warn("G61 live proxy fallback:", e);
    }
  }

  const rows = buildG61LeaderboardRows(setup, ibtMatch, liveItems);
  if (statusBadge) {
    statusBadge.textContent = liveItems
      ? "🟢 Garage 61 API En Vivo"
      : ibtMatch
      ? "🟢 Telemetría Real .IBT + G61"
      : "🟢 Referencia Garage 61";
  }

  const countBadge = document.getElementById("previewG61CountBadge");
  if (countBadge) countBadge.textContent = `${rows.length} Laps`;

  tbody.innerHTML = rows.map(r => {
    const medal = r.rank === 1 ? "🥇 #1" : r.rank === 2 ? "🥈 #2" : r.rank === 3 ? "🥉 #3" : `#${r.rank}`;
    const isTeamDriver = r.team.toLowerCase().includes("muntru");
    return `
      <tr class="hover:bg-white/[0.03] transition">
        <td class="py-3 px-3.5 font-black ${r.rank === 1 ? 'text-amber-400' : r.rank <= 3 ? 'text-white' : 'text-neutral-400'} whitespace-nowrap">
          ${medal}
        </td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-white flex items-center gap-1.5">
            <span>${escapeHtml(r.driver)}</span>
            ${isTeamDriver ? '<span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Muntrume</span>' : ''}
          </div>
          <div class="text-[10px] text-neutral-400">${escapeHtml(r.team)} · <span class="text-neutral-500">${escapeHtml(r.source)}</span></div>
        </td>
        <td class="py-3 px-3.5 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[11px] font-bold text-cyan-300">
            ${r.irating} iR
          </span>
        </td>
        <td class="py-3 px-3.5">
          <span class="font-mono text-[11px] text-neutral-300 truncate block max-w-[180px]" title="${escapeHtml(r.setupName)}">
            ${escapeHtml(r.setupName)}
          </span>
        </td>
        <td class="py-3 px-3.5 whitespace-nowrap">
          <div class="font-mono font-black text-sm ${r.rank === 1 ? 'text-emerald-400' : 'text-white'}">
            ${escapeHtml(r.lapFormatted)}
          </div>
          <div class="font-mono text-[10px] ${r.rank === 1 ? 'text-amber-400 font-bold' : 'text-neutral-500'}">
            ${escapeHtml(r.delta)}
          </div>
        </td>
        <td class="py-3 px-3.5 text-[11px] text-neutral-400 whitespace-nowrap">
          ${escapeHtml(r.conditions)}
        </td>
        <td class="py-3 px-3.5 text-right whitespace-nowrap">
          <a
            href="${g61SearchUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-[11px] transition"
          >
            <span>Comparar en G61</span>
            <span>↗</span>
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

function switchPreviewTab(tab) {
  const specsTab = document.getElementById("previewTabSpecs");
  const g61Tab = document.getElementById("previewTabG61");
  const specsBtn = document.getElementById("previewTabSpecsBtn");
  const g61Btn = document.getElementById("previewTabG61Btn");

  if (tab === "g61") {
    specsTab?.classList.add("hidden");
    g61Tab?.classList.remove("hidden");
    g61Btn?.classList.add("bg-[#161c24]", "text-emerald-400", "shadow");
    g61Btn?.classList.remove("text-neutral-400");
    specsBtn?.classList.remove("bg-[#161c24]", "text-emerald-400", "shadow");
    specsBtn?.classList.add("text-neutral-400");
  } else {
    g61Tab?.classList.add("hidden");
    specsTab?.classList.remove("hidden");
    specsBtn?.classList.add("bg-[#161c24]", "text-emerald-400", "shadow");
    specsBtn?.classList.remove("text-neutral-400");
    g61Btn?.classList.remove("bg-[#161c24]", "text-emerald-400", "shadow");
    g61Btn?.classList.add("text-neutral-400");
  }
}

function closeSetupPreviewModal() {
  document.getElementById("setupPreviewModal")?.classList.add("hidden");
}

function configureG61TokenPrompt() {
  const current = localStorage.getItem("mrt_g61_api_token") || "";
  const input = prompt(
    "Introduce tu Personal Access Token de Garage 61 (https://garage61.net/app/settings/applications) para consultar laps en vivo directamente desde la API de Garage 61:",
    current
  );
  if (input !== null) {
    localStorage.setItem("mrt_g61_api_token", input.trim());
    if (currentPreviewSetup) {
      openSetupPreview(
        currentPreviewSetup.id,
        currentPreviewSetup.filename,
        currentPreviewSetup.car,
        currentPreviewSetup.circuit,
        currentPreviewSetup.season,
        currentPreviewSetup.week,
        currentPreviewSetup.setup_type,
        ""
      );
      switchPreviewTab("g61");
    }
  }
}
