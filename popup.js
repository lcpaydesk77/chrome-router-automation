let ROUTER = 'http://192.168.1.1';

async function requestRouterPermission(ip) {
  const url = `http://${ip}/*`;
  return new Promise((resolve) => {
    chrome.permissions.request({
      origins: [url]
    }, (granted) => {
      resolve(granted);
    });
  });
}

function xmlVal(doc, tag) {
  const el = doc.querySelector(tag);
  return el ? el.textContent : null;
}

function formatBytes(bytes) {
  bytes = parseInt(bytes);
  if (bytes > 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes > 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes > 1024)       return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function formatRate(bps) {
  bps = parseInt(bps);
  if (bps > 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
  if (bps > 1024)    return (bps / 1024).toFixed(1) + ' KB/s';
  return bps + ' B/s';
}

function xhrRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.open(method, url, true);
    if (headers) for (const [k,v] of Object.entries(headers)) { try { xhr.setRequestHeader(k,v); } catch(e){} }
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body || null);
  });
}

async function getCsrf(page) {
  const r = await fetch(ROUTER + page, {cache:'no-store', credentials:'include'});
  const html = await r.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tokens = Array.from(doc.querySelectorAll('meta[name="csrf_token"]')).map(m=>m.getAttribute('content'));
  if (!tokens.length) throw new Error('No CSRF token found');
  return tokens;
}

async function isLoggedIn() {
  const text = await xhrRequest('GET', ROUTER+'/api/user/state-login', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'});
  return xmlVal(new DOMParser().parseFromString(text,'text/xml'), 'State') === '0';
}

async function login(password) {
  const tokens = await getCsrf('/html/index.html');
  const scram = CryptoJS.SCRAM();
  const firstNonce = scram.nonce().toString();

  const ct = await xhrRequest('POST', ROUTER+'/api/user/challenge_login',
    `<?xml version="1.0" encoding="UTF-8"?><request><username>admin</username><firstnonce>${firstNonce}</firstnonce><mode>1</mode></request>`,
    {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8;','__requestverificationtoken':tokens[0],'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'}
  );
  const cd = new DOMParser().parseFromString(ct,'text/xml');
  if (xmlVal(cd,'code')) throw new Error('Challenge failed ('+xmlVal(cd,'code')+')');

  const sn = xmlVal(cd,'servernonce'), sh = xmlVal(cd,'salt'), si = xmlVal(cd,'iterations');
  if (!sn||!sh||!si) throw new Error('Invalid challenge response');

  const tokens2 = await getCsrf('/html/index.html');
  const proof = scram.clientProof(password, CryptoJS.enc.Hex.parse(sh), si, firstNonce+','+sn+','+sn).toString();

  const at = await xhrRequest('POST', ROUTER+'/api/user/authentication_login',
    `<?xml version="1.0" encoding="UTF-8"?><request><username>admin</username><clientproof>${proof}</clientproof><finalnonce>${sn}</finalnonce></request>`,
    {'Content-Type':'text/xml','__requestverificationtoken':tokens2[0],'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'}
  );
  const ad = new DOMParser().parseFromString(at,'text/xml');
  if (xmlVal(ad,'code')) throw new Error(t('connecting')+' ('+xmlVal(ad,'code')+')');
}

async function ensureLoggedIn(pwd) {
  try {
    await login(pwd);
  } catch(e) {
    if (e.message && e.message.includes('108007')) {
      await new Promise(r => setTimeout(r, 800));
      await login(pwd);
    } else {
      throw e;
    }
  }
}

async function getWifiState() {
  const text = await xhrRequest('GET', ROUTER+'/api/wlan/status-switch-settings', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'});
  return xmlVal(new DOMParser().parseFromString(text,'text/xml'), 'wifienable') === '1';
}

async function setWifiState(enable) {
  const csrf = (await getCsrf('/html/content.html'))[0];
  const v = enable?1:0;
  const text = await xhrRequest('POST', ROUTER+'/api/wlan/status-switch-settings',
    `<?xml version="1.0" encoding="UTF-8"?><request><radios><radio><wifienable>${v}</wifienable><index>0</index><ID>InternetGatewayDevice.X_Config.Wifi.Radio.1.</ID></radio></radios><WifiRestart>1</WifiRestart></request>`,
    {'Content-Type':'text/xml','__requestverificationtoken':csrf,'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'}
  );
  const code = xmlVal(new DOMParser().parseFromString(text,'text/xml'),'code');
  if (code && code!=='0') throw new Error('WiFi error ('+code+')');
}

async function getMobileDataState() {
  const text = await xhrRequest('GET', ROUTER+'/api/dialup/mobile-dataswitch', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'});
  return xmlVal(new DOMParser().parseFromString(text,'text/xml'), 'dataswitch') === '1';
}

async function setMobileDataState(enable) {
  const csrf = (await getCsrf('/html/content.html'))[0];
  const v = enable?1:0;
  const text = await xhrRequest('POST', ROUTER+'/api/dialup/mobile-dataswitch',
    `<?xml version="1.0" encoding="UTF-8"?><request><dataswitch>${v}</dataswitch></request>`,
    {'Content-Type':'text/xml','__requestverificationtoken':csrf,'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'}
  );
  const code = xmlVal(new DOMParser().parseFromString(text,'text/xml'),'code');
  if (code && code!=='0') throw new Error('Data error ('+code+')');
}

function updateWifiUI(isOn) {
  const tog = document.getElementById('wifi-toggle');
  const st  = document.getElementById('wifi-state');
  tog.checked = isOn; tog.disabled = false;
  st.textContent = isOn ? t('on') : t('off');
  st.className = 'toggle-state ' + (isOn?'on':'off');
}

function updateDataUI(isOn) {
  const tog = document.getElementById('data-toggle');
  const st  = document.getElementById('data-state');
  tog.checked = isOn; tog.disabled = false;
  st.textContent = isOn ? t('on') : t('off');
  st.className = 'toggle-state ' + (isOn?'on':'off');
}

function setStatus(msg, type='') {
  const el = document.getElementById('status');
  el.innerHTML = msg; el.className = type;
}

function setLoading(msg) {
  setStatus('<span class="spinner"></span>' + msg);
}

async function loadStats() {
  try {
    const [monthText, limitText] = await Promise.all([
      xhrRequest('GET', ROUTER+'/api/monitoring/month_statistics', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'}),
      xhrRequest('GET', ROUTER+'/api/monitoring/start_date', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'})
    ]);
    const month = new DOMParser().parseFromString(monthText,'text/xml');
    const limit = new DOMParser().parseFromString(limitText,'text/xml');

    const maxBytes  = parseInt(xmlVal(limit,'trafficmaxlimit'));
    const downBytes = parseInt(xmlVal(month,'CurrentMonthDownload'));
    const upBytes   = parseInt(xmlVal(month,'CurrentMonthUpload'));
    const usedBytes = downBytes + upBytes;
    const remainBytes = Math.max(0, maxBytes - usedBytes);
    const pct = Math.min(100, usedBytes / maxBytes * 100);
    const remainPct = 100 - pct;

    document.getElementById('stat-remaining').textContent  = formatBytes(remainBytes) + ' ' + t('remaining');
    document.getElementById('stat-used-total').textContent = formatBytes(usedBytes) + ' ' + t('used') + ' ' + t('of') + ' ' + formatBytes(maxBytes);
    document.getElementById('stat-limit-label').textContent = formatBytes(maxBytes);
    const bar = document.getElementById('stat-bar');
    bar.style.width = remainPct + '%';
    document.getElementById('stats-section').style.display = '';
  } catch(e) { console.log('Stats error:', e.message); }
}

async function loadDevices() {
  try {
    const text = await xhrRequest('GET', ROUTER+'/api/system/HostInfo', null, {'_responsesource':'Broswer','x-requested-with':'XMLHttpRequest'});
    const devices = JSON.parse(text);
    const active  = devices.filter(d => d.Active);
    document.getElementById('device-count-sub').textContent = active.length ? '('+active.length+')' : '(0)';
    // Update tab button with device count
    const tabBtn = document.getElementById('devices-tab-btn');
    if (tabBtn) {
      const baseText = t('devicesTab');
      tabBtn.textContent = active.length > 0 ? baseText + ' (' + active.length + ')' : baseText;
    }
    const list = document.getElementById('device-list');
    list.innerHTML = '';
    if (!active.length) {
      list.innerHTML = '<div class="no-devices">'+t('noDevices')+'</div>';
    } else {
      active.forEach(d => {
        const name = d.ActualName || d.HostName || d.MACAddress;
        const isWifi = d.InterfaceType === 'Wireless';
        const el = document.createElement('div');
        el.className = 'device';
        el.innerHTML = `
          <div class="device-dot"></div>
          <div class="device-body">
            <div class="device-name" title="${name}">${name}</div>
            <div class="device-meta">${d.IPAddress} · ${isWifi ? '📶 '+ (d.Frequency || '2.4GHz') : '🔌 LAN'}</div>
            <div class="device-meta" style="font-size: 9px; color: var(--text2);">MAC: ${d.MACAddress}</div>
          </div>
          <div class="device-rates">
            ↓ ${formatRate((parseInt(d.DownRate)||0)*1024)}<br>
            ↑ ${formatRate((parseInt(d.UpRate)||0)*1024)}
          </div>`;
        list.appendChild(el);
      });
    }
  } catch(e) { console.log('Devices error:', e.message); }
}

async function getSignalQuality() {
  try {
    const text = await xhrRequest('GET', ROUTER+'/api/device/signal', null, {
      '_responsesource':'Broswer',
      'x-requested-with':'XMLHttpRequest'
    });
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    let rsrp = xmlVal(xml, 'rsrp');
    let rsrq = xmlVal(xml, 'rsrq');
    let rssi = xmlVal(xml, 'rssi');
    let sinr = xmlVal(xml, 'sinr');
    let pci = xmlVal(xml, 'pci');
    let band = xmlVal(xml, 'band');
    if (!rsrp) rsrp = xmlVal(xml, 'rscp');
    return { rsrp, rsrq, rssi, sinr, pci, band };
  } catch(e) { return null; }
}

// Restituisce il colore del pallino per RSRP
function getRsrpDot(rsrp) {
  if (!rsrp) return '⚪';
  const val = parseInt(rsrp);
  if (val >= -80) return '🟢';      // Eccellente
  if (val >= -90) return '🟢';      // Buono (verde chiaro, ma usiamo 🟢)
  if (val >= -105) return '🟡';     // Discreto (giallo)
  return '🟠';                       // Debole (arancione)
}

// Restituisce il colore del pallino per RSRQ
function getRsrqDot(rsrq) {
  if (!rsrq) return '⚪';
  const val = parseFloat(rsrq);
  if (val >= -5) return '🟢';       // Eccellente
  if (val >= -8) return '🟢';       // Buono
  if (val >= -12) return '🟡';      // Discreto (giallo)
  return '🟠';                       // Debole (arancione)
}

function getSignalDescription(rsrp) {
  if (!rsrp) return t('unknown');
  const val = parseInt(rsrp);
  if (val >= -80) return t('excellent');
  if (val >= -90) return t('good');
  if (val >= -105) return t('fair');
  if (val >= -120) return t('poor');
  return t('veryPoor');
}

function getRsrqDescription(rsrq) {
  if (!rsrq) return t('unknown');
  const val = parseInt(rsrq);
  if (val >= -5) return t('rsrqExcellent');
  if (val >= -8) return t('rsrqGood');
  if (val >= -12) return t('rsrqFair');
  if (val >= -16) return t('rsrqPoor');
  return t('rsrqVeryPoor');
}

function updateDetailsButtonText() {
  const btn = document.getElementById('toggle-signal-details');
  if (btn) {
    const panel = document.getElementById('signal-details-panel');
    const isVisible = panel && panel.style.display !== 'none';
    btn.innerHTML = '📋 ' + (isVisible ? t('hideDetails') : t('showDetails'));
  }
}

async function updateSignalHome() {
  const signal = await getSignalQuality();
  const container = document.getElementById('signal-home');
  if (!signal || !signal.rsrp) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  // RSRP - Potenza segnale
  document.getElementById('signal-value-home').innerHTML = signal.rsrp;
  document.getElementById('signal-desc-home').innerHTML = getSignalDescription(signal.rsrp);
  document.getElementById('signal-dot-rsrp').innerHTML = getRsrpDot(signal.rsrp);
  
  // RSRQ - Qualità segnale
  if (signal.rsrq) {
    document.getElementById('signal-rsrq-value').innerHTML = signal.rsrq;
    document.getElementById('signal-rsrq-desc').innerHTML = getRsrqDescription(signal.rsrq);
    document.getElementById('signal-dot-rsrq').innerHTML = getRsrqDot(signal.rsrq);
    document.getElementById('rsrq-container').style.display = 'block';
  } else {
    document.getElementById('rsrq-container').style.display = 'none';
  }
  
  // Dettagli (pannello espandibile)
  document.getElementById('signal-rsrp-detail').textContent = signal.rsrp ? signal.rsrp + ' dBm' : '--';
  document.getElementById('signal-rsrq-detail').textContent = signal.rsrq ? signal.rsrq + ' dB' : '--';
  document.getElementById('signal-rssi-detail').textContent = signal.rssi ? signal.rssi + ' dBm' : '--';
  document.getElementById('signal-sinr-detail').textContent = signal.sinr ? signal.sinr + ' dB' : '--';
  document.getElementById('signal-pci-detail').textContent = signal.pci || '--';
  document.getElementById('signal-band-detail').textContent = signal.band || '--';
  
  updateDetailsButtonText();
}

let busy = false;

function showLoggedInUI() {
  const pwdField = document.getElementById('password-field');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const savePwd = document.getElementById('save-pwd');
  if (pwdField) pwdField.style.display = 'none';
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = (savePwd && savePwd.checked) ? 'inline-block' : 'none';
}

function showLoggedOutUI() {
  const pwdField = document.getElementById('password-field');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  if (pwdField) pwdField.style.display = 'block';
  if (loginBtn) loginBtn.style.display = 'inline-block';
  if (logoutBtn) logoutBtn.style.display = 'none';
  const signalHome = document.getElementById('signal-home');
  if (signalHome) signalHome.style.display = 'none';
}

function logout() {
  document.getElementById('pwd').value = '';
  document.getElementById('save-pwd').checked = false;
  chrome.storage.local.remove('pwd');
  chrome.storage.local.set({savePwd: false});
  showLoggedOutUI();
  document.getElementById('stats-section').style.display = 'none';
  document.getElementById('wifi-state').textContent = t('unknown');
  document.getElementById('data-state').textContent = t('unknown');
  document.getElementById('wifi-toggle').disabled = true;
  document.getElementById('data-toggle').disabled = true;
  setStatus('', '');
}

async function init() {
  const gateway = document.getElementById('gateway-input').value;
  const ip = gateway.replace(/^https?:\/\//, '');
  
  const hasPermission = await new Promise((resolve) => {
    chrome.permissions.contains({
      origins: [`http://${ip}/*`]
    }, (result) => {
      resolve(result);
    });
  });
  
  if (!hasPermission) {
    const granted = await new Promise((resolve) => {
      chrome.permissions.request({
        origins: [`http://${ip}/*`]
      }, (granted) => {
        resolve(granted);
      });
    });
    if (!granted) {
      setStatus('Permesso negato per ' + ip, 'error');
      return;
    }
  }
  
  const pwd = document.getElementById('pwd').value.trim();
  if (!pwd) return;
  if (document.getElementById('save-pwd').checked) chrome.storage.local.set({pwd});
  setLoading(t('connecting'));
  document.getElementById('wifi-toggle').disabled = true;
  document.getElementById('data-toggle').disabled = true;
  try {
    await ensureLoggedIn(pwd);
    const [wifiOn, dataOn] = await Promise.all([getWifiState(), getMobileDataState()]);
    updateWifiUI(wifiOn);
    updateDataUI(dataOn);
    setStatus(t('connected'), 'success');
    await Promise.all([loadStats(), loadDevices(), updateSignalHome()]);
    showLoggedInUI();
  } catch(e) {
    setStatus(e.message, 'error');
    document.getElementById('wifi-state').textContent = t('unknown');
    document.getElementById('data-state').textContent = t('unknown');
    showLoggedOutUI();
  }
}

document.getElementById('wifi-toggle').addEventListener('change', async function() {
  if (busy) { this.checked = !this.checked; return; }
  busy = true;
  const wantOn = this.checked;
  this.disabled = true;
  setLoading(wantOn ? t('enablingWifi') : t('disablingWifi'));
  try {
    await ensureLoggedIn(document.getElementById('pwd').value.trim());
    await setWifiState(wantOn);
    updateWifiUI(wantOn);
    setStatus(wantOn ? t('wifiOn') : t('wifiOff'), 'success');
  } catch(e) {
    this.checked = !wantOn; updateWifiUI(!wantOn); setStatus(e.message, 'error');
  }
  busy = false;
});

document.getElementById('data-toggle').addEventListener('change', async function() {
  if (busy) { this.checked = !this.checked; return; }
  busy = true;
  const wantOn = this.checked;
  this.disabled = true;
  setLoading(wantOn ? t('enablingData') : t('disablingData'));
  try {
    await ensureLoggedIn(document.getElementById('pwd').value.trim());
    await setMobileDataState(wantOn);
    updateDataUI(wantOn);
    setStatus(wantOn ? t('dataOn') : t('dataOff'), 'success');
  } catch(e) {
    this.checked = !wantOn; updateDataUI(!wantOn); setStatus(e.message, 'error');
  }
  busy = false;
});

document.getElementById('pwd').addEventListener('keydown', e => { if (e.key==='Enter') init(); });
document.getElementById('login-btn').addEventListener('click', () => { init(); });
document.getElementById('save-pwd').addEventListener('change', function() {
  chrome.storage.local.set({savePwd: this.checked});
  if (!this.checked) chrome.storage.local.remove('pwd');
});
document.getElementById('logout-btn').addEventListener('click', () => { logout(); });

document.getElementById('refresh-signal-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-signal-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> ' + t('refreshSignal');
  await updateSignalHome();
  btn.innerHTML = '🔄 ' + t('refreshSignal');
  btn.disabled = false;
});

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('toggle-signal-details').addEventListener('click', () => {
  const panel = document.getElementById('signal-details-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
  updateDetailsButtonText();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-devices').classList.remove('active');
  document.getElementById('page-settings').classList.add('active');
});
document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('page-settings').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="home"]').classList.add('active');
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${target}`).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (target === 'devices') loadDevices();
  });
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const gw = document.getElementById('gateway-input').value.trim();
  const lang = document.querySelector('.lang-btn.active')?.dataset.lang || 'en';
  if (gw) {
    ROUTER = 'http://' + gw.replace(/^https?:\/\//, '');
    document.getElementById('gateway-display').textContent = gw;
    chrome.storage.local.set({gateway: gw, lang});
    currentLang = lang;
    applyI18n();
    const statusEl = document.getElementById('status');
    if (statusEl.classList.contains('success')) setStatus(t('connected'), 'success');
    const pwd = document.getElementById('pwd').value.trim();
    if (pwd) {
      try {
        await ensureLoggedIn(pwd);
        await Promise.all([loadStats(), loadDevices(), updateSignalHome()]);
      } catch(e) {}
    }
  }
  document.getElementById('page-settings').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  document.querySelector('.tab[data-tab="home"]').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="home"]').classList.add('active');
});

document.getElementById('donate-btn').addEventListener('click', e => {
  e.preventDefault();
  window.opn('https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=lc.paydesk77@gmail.com&currency_code=EUR', '_blank');
});

chrome.storage.local.get(['pwd','savePwd','gateway','lang'], ({pwd, savePwd, gateway, lang}) => {
  initI18n(lang);
  if (gateway) {
    ROUTER = 'http://' + gateway.replace(/^https?:\/\//, '');
    document.getElementById('gateway-display').textContent = gateway;
    document.getElementById('gateway-input').value = gateway;
  }
  const saveEl = document.getElementById('save-pwd');
  saveEl.checked = savePwd === true;
  if (pwd && saveEl.checked) {
    document.getElementById('pwd').value = pwd;
    showLoggedInUI();
    init();
  } else {
    showLoggedOutUI();
  }
});
