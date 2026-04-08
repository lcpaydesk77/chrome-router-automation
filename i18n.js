// i18n system
const MESSAGES = {
  en: {
    appName: "Router Manager", appDesc: "Manage your Huawei router",
    password: "Router password", passwordPlaceholder: "Your password",
    rememberPassword: "Remember password", gateway: "Gateway",
    wifi: "WiFi", mobileData: "Mobile Data", on: "ON", off: "OFF", unknown: "—",
    connecting: "Connecting...", connected: "Connected ✓",
    wifiOn: "WiFi enabled ✓", wifiOff: "WiFi disabled ✓",
    dataOn: "Mobile data enabled ✓", dataOff: "Mobile data disabled ✓",
    enablingWifi: "Enabling WiFi...", disablingWifi: "Disabling WiFi...",
    enablingData: "Enabling data...", disablingData: "Disabling data...",
    statsTitle: "Monthly statistics", download: "↓ Download", upload: "↑ Upload",
    dlSpeed: "↓ Speed", ulSpeed: "↑ Speed",
    remaining: "Remaining data", used: "used", of: "of",
    devicesTitle: "Connected devices", noDevices: "No connected devices",
    donate: "☕ Buy me a coffee", disclaimer: "Tested on Huawei B311. Use at your own risk.",
    language: "Language", settings: "Settings", back: "← Back", save: "Save",
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    veryPoor: "Very poor",
    error: "Error",
    refresh: "Refresh",
    refreshSignal: "Refresh",
    rsrqExcellent: "Excellent",
    rsrqGood: "Good",
    rsrqFair: "Fair",
    rsrqPoor: "Poor",
    rsrqVeryPoor: "Very poor",
    showDetails: "Show details",
    hideDetails: "Hide details",
    logout: "Logout",
    homeTab: "🏠 Home",
    devicesTab: "📱 Devices"
  },
  it: {
    appName: "Router Manager", appDesc: "Gestisci il tuo router Huawei",
    password: "Password router", passwordPlaceholder: "La tua password",
    rememberPassword: "Ricorda password", gateway: "Gateway",
    wifi: "WiFi", mobileData: "Dati mobili", on: "ON", off: "OFF", unknown: "—",
    connecting: "Connessione...", connected: "Connesso ✓",
    wifiOn: "WiFi acceso ✓", wifiOff: "WiFi spento ✓",
    dataOn: "Dati attivati ✓", dataOff: "Dati disattivati ✓",
    enablingWifi: "Accensione WiFi...", disablingWifi: "Spegnimento WiFi...",
    enablingData: "Attivazione dati...", disablingData: "Disattivazione dati...",
    statsTitle: "Statistiche mensili", download: "↓ Download", upload: "↑ Upload",
    dlSpeed: "↓ Velocità", ulSpeed: "↑ Velocità",
    remaining: "Giga restanti", used: "usati", of: "su",
    devicesTitle: "Dispositivi connessi", noDevices: "Nessun dispositivo connesso",
    donate: "☕ Offrimi un caffè", disclaimer: "Testata su Huawei B311. Usare a proprio rischio.",
    language: "Lingua", settings: "Impostazioni", back: "← Indietro", save: "Salva",
    excellent: "Eccellente",
    good: "Buono",
    fair: "Discreto",
    poor: "Debole",
    veryPoor: "Molto debole",
    error: "Errore",
    refresh: "Aggiorna",
    refreshSignal: "Aggiorna",
    rsrqExcellent: "Eccellente",
    rsrqGood: "Buono",
    rsrqFair: "Discreto",
    rsrqPoor: "Debole",
    rsrqVeryPoor: "Pessimo",
    showDetails: "Mostra dettagli",
    hideDetails: "Nascondi dettagli",
    logout: "Esci",
    homeTab: "🏠 Home",
    devicesTab: "📱 Dispositivi"
  },
  es: {
    appName: "Router Manager", appDesc: "Gestiona tu router Huawei",
    password: "Contraseña del router", passwordPlaceholder: "Tu contraseña",
    rememberPassword: "Recordar contraseña", gateway: "Puerta de enlace",
    wifi: "WiFi", mobileData: "Datos móviles", on: "ON", off: "OFF", unknown: "—",
    connecting: "Conectando...", connected: "Conectado ✓",
    wifiOn: "WiFi activado ✓", wifiOff: "WiFi desactivado ✓",
    dataOn: "Datos activados ✓", dataOff: "Datos desactivados ✓",
    enablingWifi: "Activando WiFi...", disablingWifi: "Desactivando WiFi...",
    enablingData: "Activando datos...", disablingData: "Desactivando datos...",
    statsTitle: "Estadísticas mensuales", download: "↓ Descarga", upload: "↑ Subida",
    dlSpeed: "↓ Velocidad", ulSpeed: "↑ Velocidad",
    remaining: "Datos restantes", used: "usados", of: "de",
    devicesTitle: "Dispositivos conectados", noDevices: "No hay dispositivos conectados",
    donate: "☕ Invítame un café", disclaimer: "Probado en Huawei B311. Úsalo bajo tu responsabilidad.",
    language: "Idioma", settings: "Ajustes", back: "← Volver", save: "Guardar",
    excellent: "Excelente",
    good: "Bueno",
    fair: "Regular",
    poor: "Débil",
    veryPoor: "Muy débil",
    error: "Error",
    refresh: "Actualizar",
    refreshSignal: "Actualizar",
    rsrqExcellent: "Excelente",
    rsrqGood: "Bueno",
    rsrqFair: "Regular",
    rsrqPoor: "Débil",
    rsrqVeryPoor: "Muy débil",
    showDetails: "Mostrar detalles",
    hideDetails: "Ocultar detalles",
    logout: "Salir",
    homeTab: "🏠 Inicio",
    devicesTab: "📱 Dispositivos"
  }
};

let currentLang = 'en';

function detectLang() {
  const bl = (navigator.language || 'en').substring(0, 2).toLowerCase();
  return MESSAGES[bl] ? bl : 'en';
}

function t(key) {
  return (MESSAGES[currentLang] && MESSAGES[currentLang][key]) || MESSAGES['en'][key] || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  if (typeof updateDetailsButtonText === 'function') updateDetailsButtonText();
}

function initI18n(savedLang) {
  currentLang = savedLang || detectLang();
  applyI18n();
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}