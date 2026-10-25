/**
 * Muntrume Motorsport - Setup Vault System
 * Direct iRacing File System Sync & Cloudflare D1 Catalog
 */

const API_BASE = "https://muntrume.atrumin16.workers.dev";
let currentToken = null;
let currentUser = null;
let allSetups = [];
let currentTypeFilter = "All";
let iracingDirHandle = null;
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
  "stockcars2 mustang2019": "NASCAR Cup Mustang 2019",
  "supercars fordmustanggen3": "Supercars Mustang Gen3",
  "superformulalights324": "Super Formula Lights 324",
  "superformulasf23 honda": "Super Formula SF23 Honda",
  "superformulasf23 toyota": "Super Formula SF23 Toyota",
  "toyotagr86": "Toyota GR86",
  "trucks silverado": "NASCAR Craftsman Truck Silverado",
  "trucks toyotatundra2022": "NASCAR Craftsman Truck Tundra"
};

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
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
// DIRECT IRACING FOLDER LINK (File System API)
// ==========================================
async function toggleLinkDirectory() {
  if (!('showDirectoryPicker' in window)) {
    alert("Tu navegador no soporta la API de acceso directo al disco local. Te recomendamos usar Google Chrome, Microsoft Edge o Brave en Windows para guardar directamente en Documents\\iRacing\\setups.");
    return;
  }

  if (iracingDirHandle) {
    if (confirm("¿Deseas desvincular la carpeta de iRacing? Las próximas descargas volverán a guardarse en la carpeta Descargas normal del navegador.")) {
      iracingDirHandle = null;
      updateLinkDirectoryUI(false);
      showDownloadToast("Carpeta desvinculada");
    }
    return;
  }

  try {
    iracingDirHandle = await window.showDirectoryPicker({
      id: "iracing-setups-picker",
      mode: "readwrite",
      startIn: "documents"
    });

    updateLinkDirectoryUI(true, iracingDirHandle.name);
    showDownloadToast(`✅ Carpeta vinculada: ${iracingDirHandle.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error("DirectoryPicker error:", err);
      alert("No se pudo acceder a la carpeta: " + err.message);
    }
  }
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
    if (metricStatus) {
      metricStatus.textContent = "Listo";
      metricStatus.className = "text-2xl font-black text-emerald-400 mt-1";
    }
  }
  applyFilters();
}

// ==========================================
// CATALOG MANAGEMENT & FILTERING
// ==========================================
async function loadCatalog() {
  const skeleton = document.getElementById("loadingSkeleton");
  const grid = document.getElementById("setupsGrid");
  skeleton?.classList.remove("hidden");
  if (grid) grid.innerHTML = "";

  const car = document.getElementById("carSelect")?.value || "";
  const season = document.getElementById("seasonSelect")?.value || "";
  const week = document.getElementById("weekSelect")?.value || "";
  const circuit = document.getElementById("circuitSelect")?.value || "";

  try {
    const res = await fetch(`${API_BASE}/api/setups/catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ car, season, week, circuit })
    });

    const data = await res.json();

    if (res.status === 401) {
      handleLogout();
      return;
    }

    if (res.ok && data.success) {
      allSetups = data.setups || [];
      if (!dropdownsInitialized) {
        populateAllDropdowns(data.cars || [], data.seasons || [], data.weeks || [], data.circuits || []);
        dropdownsInitialized = true;
      }
      applyFilters();
    }
  } catch (err) {
    console.error("Error cargando catálogo:", err);
  } finally {
    skeleton?.classList.add("hidden");
  }
}

function onFilterChange() {
  loadCatalog();
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

  // 3. Semanas (W01 a W13 + Otros)
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

  // 4. Circuitos (61)
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

function applyFilters() {
  const query = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();

  const filtered = allSetups.filter(s => {
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

  renderSetups(filtered);
}

function renderSetups(setups) {
  const grid = document.getElementById("setupsGrid");
  const empty = document.getElementById("emptyState");
  const countLabel = document.getElementById("visibleSetupsCount");

  if (countLabel) countLabel.textContent = setups.length;

  if (setups.length === 0) {
    if (grid) grid.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  const isDirectLinked = !!iracingDirHandle;

  if (!grid) return;

  grid.innerHTML = setups.map(s => {
    const carName = CAR_LABELS[s.car] || s.car;
    const sizeKb = (s.size_bytes / 1024).toFixed(1);
    
    let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s.setup_type === "Qualy") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (s.setup_type === "Wet") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";

    const destinationPath = `${s.car}\\Garage 61 - Muntrume Motorsport\\${s.season}\\${s.week}\\${s.circuit}\\${s.filename}`;

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
            <span class="truncate">setups\\${escapeHtml(destinationPath)}</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <span class="text-[10px] text-neutral-500 font-mono">${sizeKb} KB · .sto</span>
          
          <div class="flex items-center gap-1.5">
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
              class="px-3 py-1.5 rounded-lg ${isDirectLinked ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-lg shadow-emerald-500/20' : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold'} text-xs transition flex items-center gap-1.5 shadow"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>${isDirectLinked ? '⚡ Guardar en iRacing' : 'Descargar'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Download setup (Direct to local iRacing folder or browser fallback)
async function downloadSetup(setupId, fallbackFilename) {
  try {
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

    const filename = data.filename || fallbackFilename;
    const byteChars = atob(data.content_base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }

    // Direct write to disk if iRacing setups directory is linked
    if (iracingDirHandle) {
      try {
        // Build path: <car>/Garage 61 - Muntrume Motorsport/<season>/<week>/<circuit>/<filename>
        const carFolder = await iracingDirHandle.getDirectoryHandle(data.car, { create: true });
        const teamFolder = await carFolder.getDirectoryHandle("Garage 61 - Muntrume Motorsport", { create: true });
        const seasonFolder = await teamFolder.getDirectoryHandle(data.season || "26S4", { create: true });
        const weekFolder = await seasonFolder.getDirectoryHandle(data.week || "W01", { create: true });
        const circFolder = await weekFolder.getDirectoryHandle(data.circuit || "General", { create: true });

        const fileHandle = await circFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(byteArray);
        await writable.close();

        showDownloadToast(`✅ Guardado directo en iRacing: ${data.car}\\...\\${filename}`);
        return;
      } catch (fsErr) {
        console.warn("Fallo escribiendo directo en disco:", fsErr);
        // Fallback to standard web download
      }
    }

    // Web download fallback
    const blob = new Blob([byteArray], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showDownloadToast(`Descargado: ${filename} (¡Vincula tu carpeta iRacing arriba para guardarlo directo!)`);
  } catch (err) {
    alert("Error de conexión al descargar setup.");
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
      showDownloadToast(`Piloto ${email} aprobado`);
      await loadAdminData();
    }
  } catch (e) {
    alert("Error al aprobar piloto.");
  }
}

async function handleManualAdd(e) {
  e.preventDefault();
  const name = document.getElementById("manualName").value.trim();
  const email = document.getElementById("manualEmail").value.trim();
  const feedback = document.getElementById("manualAddFeedback");

  try {
    const res = await fetch(`${API_BASE}/api/setups/admin/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ email, name })
    });
    const data = await res.json();
    if (data.success) {
      feedback.textContent = `Piloto ${email} autorizado en D1. Ya puede acceder al Vault.`;
      feedback.classList.remove("hidden");
      document.getElementById("manualName").value = "";
      document.getElementById("manualEmail").value = "";
      await loadAdminData();
      setTimeout(() => feedback.classList.add("hidden"), 4000);
    }
  } catch (err) {
    alert("Error al añadir piloto.");
  }
}
