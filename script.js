// MQTT Config
const broker = "wss://90b9c5b7f1b7432eb1a687d54b093696.s1.eu.hivemq.cloud:8884/mqtt";
const mqttUser = "ALYAMAULIDAAVIKA";
const mqttPass = "05_alyaUKK2026";
const clientId = "web_" + Math.random().toString(16).substr(2, 8);
const subTopics = ["iot/suhu", "iot/kelembaban", "iot/ldr", "iot/relay1", "iot/relay2", "iot/relay3", "iot/relay4", "iot/mode"];

let mqttClient, mqttConnected = false;
let autoMode = false;
let ledState = [false, false, false, false];
let currentTemp = 25, currentHum = 60, currentLDR = "GELAP";
let historyData = [];
const MAX_CHART = 20;
let tempHistory = [], humHistory = [], timeLabels = [];
let tempChart, humChart;
let mqttLogs = [];

// DOM Elements
const tempVal = document.getElementById('tempVal'), humVal = document.getElementById('humVal');
const ldrIconSpan = document.getElementById('ldrIcon'), ldrTextSpan = document.getElementById('ldrText');
const modeBadge = document.getElementById('modeBadge'), modeFooter = document.getElementById('modeFooter');
const autoWarningDiv = document.getElementById('autoWarning');
const ledPanelDiv = document.getElementById('ledPanel');
const logContainer = document.getElementById('logContainer');
const historyBodyFull = document.getElementById('historyBodyFull');
const mqttStatusDetail = document.getElementById('mqttStatusDetail');
const mqttClientIdSpan = document.getElementById('mqttClientIdSpan');
const espOnlineText = document.getElementById('espOnlineText');
const espLed = document.getElementById('espLed');
const signalIcon = document.getElementById('signalIcon');
const mqttDescText = document.getElementById('mqttDescText');

if (mqttClientIdSpan) mqttClientIdSpan.innerText = clientId;

// ----- Fungsi update gradien lingkaran sesuai tema -----
function updateCircularGradients(theme) {
  const isDark = theme === 'dark';
  const startColor = isDark ? '#4effdc' : '#ff66b2';
  const endColor = isDark ? '#b56eff' : '#ff99cc';
  ['ldrStop1'].forEach(id => {
    const stop = document.getElementById(id);
    if (stop) stop.setAttribute('stop-color', startColor);
  });
  ['ldrStop2'].forEach(id => {
    const stop = document.getElementById(id);
    if (stop) stop.setAttribute('stop-color', endColor);
  });
  applySensorTemperatureColors(currentTemp);
}

// ----- Fungsi Circular Progress -----
function updateCircularProgress(elementId, percent) {
  const circle = document.getElementById(elementId);
  if (!circle) return;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = circumference - (percent / 100) * circumference;
  offset = Math.min(Math.max(offset, 0), circumference);
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = offset;
}

// ----- Warna tampilan suhu dan kelembaban berdasarkan suhu -----
const sensorStatusColors = {
  normal: { start: '#22c55e', end: '#86efac' },
  warning: { start: '#facc15', end: '#f97316' },
  danger: { start: '#ef4444', end: '#f87171' }
};

function getTemperatureStatus(temp) {
  const t = parseFloat(temp);
  if (Number.isNaN(t)) return 'normal';
  if (t >= 31) return 'danger';
  if (t > 25 && t < 31) return 'warning';
  if (t >= 20 && t <= 25) return 'normal';
  return 'warning';
}

function applySensorTemperatureColors(temp) {
  const status = getTemperatureStatus(temp);
  const colors = sensorStatusColors[status];
  const statusClasses = ['sensor-status-normal', 'sensor-status-warning', 'sensor-status-danger'];

  ['tempCard', 'humCard'].forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove(...statusClasses);
    card.classList.add(`sensor-status-${status}`);
  });

  [
    ['tempStop1', colors.start],
    ['tempStop2', colors.end],
    ['humStop1', colors.start],
    ['humStop2', colors.end]
  ].forEach(([id, color]) => {
    const stop = document.getElementById(id);
    if (stop) stop.setAttribute('stop-color', color);
  });
}

// ========== UPDATE WARNING BANNER GAYA SIMULASI ==========
function updateWarningBanner(temp) {
  const t = parseFloat(temp);
  let level = '', iconHtml = '', message = '';

  if (t >= 31) {
    level = 'danger';
    iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
    message = `⚠️ Suhu sangat panas ${t}°C! Bahaya, segera pendinginkan ruangan. ⚠️`;
  } else if (t > 25 && t < 31) {
    level = 'warning';
    iconHtml = '<i class="fas fa-temperature-high"></i>';
    message = `🌡️ Suhu tinggi ${t}°C, waspada dehidrasi dan gunakan kipas atau AC.`;
  } else if (t >= 20 && t <= 25) {
    level = 'normal';
    iconHtml = '<i class="fas fa-check-circle"></i>';
    message = `✅ Suhu normal ${t}°C, kondisi nyaman dan ideal untuk beraktivitas.`;
  } else if (t < 20) {
    level = 'warning';
    iconHtml = '<i class="fas fa-snowflake"></i>';
    message = `❄️ Suhu dingin ${t}°C, segera hangatkan ruangan.`;
  }

  const banner = document.getElementById('warningBanner');
  const iconSpan = document.getElementById('warningIcon');
  const msgSpan = document.getElementById('warningMsg');

  if (banner && iconSpan && msgSpan) {
    banner.classList.remove('normal', 'warning', 'danger');
    banner.classList.add(level);
    iconSpan.innerHTML = iconHtml;
    msgSpan.innerText = message;
  }
}

// ----- Update UI Sensor dengan Circular -----
function updateSensorUI(temp, hum, ldr) {
  currentTemp = temp;
  currentHum = hum;
  currentLDR = ldr;

  tempVal.innerText = temp.toFixed(1);
  humVal.innerText = Math.round(hum);
  applySensorTemperatureColors(temp);

  let tempPercent = Math.min(100, (temp / 50) * 100);
  let humPercent = Math.min(100, hum);
  let ldrPercent = (ldr.toUpperCase() === "TERANG") ? 18 : 88;

  updateCircularProgress("tempCircleFill", tempPercent);
  updateCircularProgress("humCircleFill", humPercent);
  updateCircularProgress("ldrCircleFill", ldrPercent);

  if (ldr.toUpperCase() === "TERANG") {
    ldrIconSpan.innerHTML = '🌙';
    ldrTextSpan.innerText = 'Gelap';
  } else {
    ldrIconSpan.innerHTML = '☀️';
    ldrTextSpan.innerText = 'Terang';
  }

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ldrDisp = ldr.toUpperCase() === "TERANG" ? "Gelap" : "Terang";
  historyData.unshift({ time: now, temp: temp.toFixed(1), hum: Math.round(hum), ldr: ldrDisp });
  if (historyData.length > 30) historyData.pop();
  renderHistoryFull();
  updateCharts(temp, hum);

  // Update banner peringatan suhu setiap kali suhu berubah
  updateWarningBanner(temp);
}

// ----- Update tema website berdasarkan nilai LDR (TERANG -> light, GELAP -> dark) -----
let isDark = true;
function applyThemeFromLDR(ldrValue) {
  const upperLdr = ldrValue.toUpperCase();
  let newTheme = '';
  if (upperLdr === "TERANG") newTheme = 'dark';
  else if (upperLdr === "GELAP") newTheme = 'light';
  else return;

  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === newTheme) return;

  document.documentElement.setAttribute('data-theme', newTheme);
  isDark = (newTheme === 'dark');
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.innerText = isDark ? '🌙' : '🌸';
  updateChartColors();
  updateCircularGradients(newTheme);
  addLog("System", `Tema otomatis berubah menjadi ${newTheme.toUpperCase()} (interpretasi LDR: ${upperLdr === "TERANG" ? "GELAP" : "TERANG"})`, false);
}

// ----- Update ESP UI -----
function updateESPUI(connected) {
  if (connected) {
    espOnlineText.innerText = "Online • Connected";
    espOnlineText.className = "esp-online-status online";
    if (espLed) espLed.classList.add("online");
    if (signalIcon) signalIcon.style.color = "#10b981";
    mqttDescText.innerHTML = "MQTT Subscribed | HiveMQ Secure";
    mqttStatusDetail.innerHTML = '<i class="fas fa-check-circle status-connected"></i> Terhubung';
  } else {
    espOnlineText.innerText = "Offline • Disconnected";
    espOnlineText.className = "esp-online-status offline";
    if (espLed) espLed.classList.remove("online");
    if (signalIcon) signalIcon.style.color = "#ef4444";
    mqttDescText.innerHTML = "Koneksi putus, mencoba ulang...";
    mqttStatusDetail.innerHTML = '<i class="fas fa-times-circle status-disconnected"></i> Putus';
  }
  updateMQTTDetailUI(connected);
}

function updateMQTTDetailUI(connected) {
  if (connected) {
    mqttStatusDetail.innerHTML = '<i class="fas fa-check-circle status-connected"></i> <span class="status-connected">Terhubung (Online)</span>';
  } else {
    mqttStatusDetail.innerHTML = '<i class="fas fa-times-circle status-disconnected"></i> <span class="status-disconnected">Putus / Reconnecting</span>';
  }
}

// ----- Logging -----
function addLog(topic, payload, isError = false, isSend = false) {
  const time = new Date().toLocaleTimeString();
  const prefix = isSend ? "→ PUB" : "← SUB";
  mqttLogs.unshift({ time, topic: `${prefix} ${topic}`, payload, isError });
  if (mqttLogs.length > 55) mqttLogs.pop();
  renderLog();
}

function renderLog() {
  if (!logContainer) return;
  if (mqttLogs.length === 0) {
    logContainer.innerHTML = '<div class="log-entry"><span class="log-time">--:--:--</span><span class="log-topic">System</span><span class="log-payload">Belum ada log</span></div>';
    return;
  }
  logContainer.innerHTML = mqttLogs.map(log => `<div class="log-entry"><span class="log-time">${log.time}</span><span class="log-topic" style="color:${log.isError ? '#f97316' : 'var(--cyan-lux)'}">${log.topic}</span><span class="log-payload">${log.payload}</span></div>`).join('');
}

// ----- Riwayat & Charts -----
function renderHistoryFull() {
  if (!historyBodyFull) return;
  if (historyData.length === 0) {
    historyBodyFull.innerHTML = '<tr><td colspan="5">Belum ada data</td></tr>';
    return;
  }
  historyBodyFull.innerHTML = historyData.map((r, i) => `
    <tr>
      <td>${historyData.length - i}</td>
      <td>${r.time}</td>
      <td><strong>${r.temp}°C</strong></td>
      <td>${r.hum}%</td>
      <td>${r.ldr}</td>
    </tr>
  `).join('');
}

function getCssVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function createTempGradient(ctx, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(255, 123, 114, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 123, 114, 0.02)');
  return gradient;
}

function createHumGradient(ctx, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(74, 222, 128, 0.35)');
  gradient.addColorStop(1, 'rgba(74, 222, 128, 0.02)');
  return gradient;
}

function initCharts() {
  const ctxT = document.getElementById('tempChart').getContext('2d');
  const ctxH = document.getElementById('humChart').getContext('2d');
  for (let i = 0; i < MAX_CHART; i++) {
    timeLabels.push('--');
    tempHistory.push(25);
    humHistory.push(60);
  }
  const tickColor = getCssVar('--chart-tick-color');
  const gridColor = getCssVar('--chart-grid-color');

  tempChart = new Chart(ctxT, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: 'Suhu (°C)',
        data: tempHistory,
        borderColor: '#ff7b72',
        backgroundColor: function (context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          return createTempGradient(ctx, chartArea.bottom);
        },
        borderWidth: 3,
        pointRadius: 4,
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff',
        pointBackgroundColor: '#ff7b72',
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#ff7b72',
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tickColor, font: { size: 11, weight: 'bold' } } },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#ff7b72',
          bodyColor: '#fff',
          borderColor: '#ff7b72',
          borderWidth: 1,
          callbacks: { label: (context) => ` ${context.raw}°C` }
        }
      },
      scales: {
        x: { ticks: { color: tickColor, maxRotation: 35, font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: tickColor, stepSize: 5, callback: v => v + '°C', font: { size: 10 } }, grid: { color: gridColor }, title: { display: true, text: 'Suhu (°C)', color: tickColor, font: { size: 11 } } }
      },
      elements: { line: { borderJoin: 'round', borderCap: 'round', shadowOffsetX: 0, shadowOffsetY: 2, shadowBlur: 6, shadowColor: 'rgba(255, 123, 114, 0.5)' } }
    }
  });

  humChart = new Chart(ctxH, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: 'Kelembaban (%)',
        data: humHistory,
        borderColor: '#4ade80',
        backgroundColor: function (context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, 0, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(74, 222, 128, 0.35)');
          gradient.addColorStop(1, 'rgba(74, 222, 128, 0.02)');
          return gradient;
        },
        borderWidth: 3,
        pointRadius: 4,
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff',
        pointBackgroundColor: '#4ade80',
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#4ade80',
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tickColor, font: { size: 11, weight: 'bold' } } },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#4ade80',
          bodyColor: '#fff',
          borderColor: '#4ade80',
          borderWidth: 1,
          callbacks: { label: (context) => ` ${context.raw}%` }
        }
      },
      scales: {
        x: { ticks: { color: tickColor, maxRotation: 35, font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: tickColor, stepSize: 10, callback: v => v + '%', font: { size: 10 } }, grid: { color: gridColor }, title: { display: true, text: 'Kelembaban (%)', color: tickColor, font: { size: 11 } } }
      },
      elements: { line: { borderJoin: 'round', borderCap: 'round', shadowOffsetX: 0, shadowOffsetY: 2, shadowBlur: 6, shadowColor: 'rgba(74, 222, 128, 0.5)' } }
    }
  });
}

function updateChartColors() {
  const tickColor = getCssVar('--chart-tick-color');
  const gridColor = getCssVar('--chart-grid-color');
  if (tempChart) {
    tempChart.options.plugins.legend.labels.color = tickColor;
    tempChart.options.scales.x.ticks.color = tickColor;
    tempChart.options.scales.y.ticks.color = tickColor;
    tempChart.options.scales.y.title.color = tickColor;
    tempChart.options.scales.y.grid.color = gridColor;
    tempChart.update();
    humChart.options.plugins.legend.labels.color = tickColor;
    humChart.options.scales.x.ticks.color = tickColor;
    humChart.options.scales.y.ticks.color = tickColor;
    humChart.options.scales.y.title.color = tickColor;
    humChart.options.scales.y.grid.color = gridColor;
    humChart.update();
  }
}

function updateCharts(temp, hum) {
  const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  tempHistory.push(temp);
  humHistory.push(hum);
  timeLabels.push(label);
  if (tempHistory.length > MAX_CHART) {
    tempHistory.shift();
    humHistory.shift();
    timeLabels.shift();
  }
  tempChart.data.labels = [...timeLabels];
  tempChart.data.datasets[0].data = [...tempHistory];
  humChart.data.labels = [...timeLabels];
  humChart.data.datasets[0].data = [...humHistory];
  tempChart.update('none');
  humChart.update('none');
}

// ----- LED Control (optimistic update) -----
function renderLEDs() {
  if (!ledPanelDiv) return;
  ledPanelDiv.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = `led-card ${autoMode ? 'disabled' : ''}`;
    if (!autoMode) div.onclick = () => toggleLED(i);
    const icon = document.createElement('i');
    icon.className = `led-icon fas fa-lightbulb ${ledState[i] ? 'on' : 'off'}`;
    const label = document.createElement('div');
    label.innerText = `LED ${i + 1}`;
    const statusSpan = document.createElement('div');
    statusSpan.innerText = ledState[i] ? 'ON' : 'OFF';
    div.append(icon, label, statusSpan);
    ledPanelDiv.appendChild(div);
  }
  autoWarningDiv.style.display = autoMode ? 'block' : 'none';
  const modeTxt = autoMode ? 'AUTO' : 'MANUAL';
  modeBadge.innerText = modeTxt;
  modeFooter.innerText = modeTxt;
}

function toggleLED(idx) {
  if (autoMode) return;
  ledState[idx] = !ledState[idx];
  renderLEDs();
  const topic = `iot/relay${idx + 1}/set`;
  const payload = ledState[idx] ? "ON" : "OFF";
  if (mqttClient && mqttConnected) {
    mqttClient.send(topic, payload, 0, false);
    addLog(topic, payload, false, true);
  } else {
    addLog(topic, payload, true, true);
  }
}

function allLEDs(on) {
  if (autoMode) return;
  for (let i = 0; i < 4; i++) ledState[i] = on;
  renderLEDs();
  for (let i = 0; i < 4; i++) {
    const topic = `iot/relay${i + 1}/set`;
    const payload = on ? "ON" : "OFF";
    if (mqttClient && mqttConnected) mqttClient.send(topic, payload, 0, false);
  }
  addLog("Bulk", `Semua LED ${on ? "ON" : "OFF"}`, false, true);
}

function updateLEDFromMQTT(relayNum, state) {
  const idx = relayNum - 1;
  const newState = (state === "ON");
  if (ledState[idx] !== newState) {
    ledState[idx] = newState;
    renderLEDs();
    addLog("Sync", `LED ${relayNum} disinkronkan dari ESP menjadi ${state}`, false);
  }
}

// ----- MQTT Handlers -----
function onMessageArrived(message) {
  const topic = message.destinationName, payload = message.payloadString;
  addLog(topic, payload);
  if (topic === "iot/suhu") {
    let v = parseFloat(payload);
    if (!isNaN(v)) currentTemp = v;
    updateSensorUI(currentTemp, currentHum, currentLDR);
  } else if (topic === "iot/kelembaban") {
    let v = parseFloat(payload);
    if (!isNaN(v)) currentHum = v;
    updateSensorUI(currentTemp, currentHum, currentLDR);
  } else if (topic === "iot/ldr") {
    currentLDR = payload;
    updateSensorUI(currentTemp, currentHum, currentLDR);
    applyThemeFromLDR(payload);
  } else if (topic === "iot/relay1") updateLEDFromMQTT(1, payload);
  else if (topic === "iot/relay2") updateLEDFromMQTT(2, payload);
  else if (topic === "iot/relay3") updateLEDFromMQTT(3, payload);
  else if (topic === "iot/relay4") updateLEDFromMQTT(4, payload);
  else if (topic === "iot/mode") {
    autoMode = (payload.toUpperCase() === "AUTO");
    renderLEDs();
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader && !loader.classList.contains('hide')) {
    loader.classList.add('hide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function onConnect() {
  mqttConnected = true;
  updateESPUI(true);
  subTopics.forEach(t => mqttClient.subscribe(t));
  addLog("System", "MQTT Terhubung ke HiveMQ");
  hideLoader();
}

function onConnectionLost() {
  mqttConnected = false;
  updateESPUI(false);
  addLog("System", "Koneksi putus, reconnect...", true);
  setTimeout(() => {
    if (mqttClient) mqttClient.connect({ userName: mqttUser, password: mqttPass, useSSL: true, onSuccess: onConnect, onFailure: onConnectionLost });
  }, 4000);
}

function initMQTT() {
  mqttClient = new Paho.MQTT.Client(broker, clientId);
  mqttClient.onMessageArrived = onMessageArrived;
  mqttClient.onConnectionLost = onConnectionLost;
  mqttClient.connect({
    userName: mqttUser, password: mqttPass, useSSL: true, onSuccess: onConnect, onFailure: (err) => {
      addLog("Error", `Gagal: ${err.errorMessage}`, true);
      document.getElementById('loader').classList.add('hide');
      updateESPUI(false);
      setTimeout(() => initMQTT(), 5000);
    }
  });
  setTimeout(() => hideLoader(), 2500);
}

// ----- Theme Manual & Clock -----
function toggleTheme() {
  isDark = !isDark;
  const newTheme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.getElementById('themeToggle').innerText = isDark ? '🌙' : '🌸';
  updateChartColors();
  updateCircularGradients(newTheme);
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
setInterval(() => {
  document.getElementById('liveClock').innerText = new Date().toLocaleTimeString('id-ID');
}, 1000);

// ----- Page Switching & Resize -----
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
  document.getElementById(`${pageId}Page`).classList.add('active-page');
  document.querySelectorAll('.nav-link').forEach(btn => {
    if (btn.getAttribute('data-page') === pageId) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  if (pageId === 'history') renderHistoryFull();
}
document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => {
  const p = btn.getAttribute('data-page');
  if (p) switchPage(p);
  document.getElementById('mobileMenu')?.classList.remove('show');
}));
document.getElementById('menuToggle')?.addEventListener('click', () => {
  const menu = document.getElementById('mobileMenu');
  const nav = document.querySelector('.navbar');
  menu?.classList.toggle('show');
  nav?.classList.toggle('menu-open');
});
document.getElementById('clearLogBtn')?.addEventListener('click', () => { mqttLogs = []; renderLog(); });
document.getElementById('allOnBtn')?.addEventListener('click', () => allLEDs(true));
document.getElementById('allOffBtn')?.addEventListener('click', () => allLEDs(false));
window.addEventListener('resize', () => { if (tempChart && humChart) { tempChart.resize(); humChart.resize(); } });

// ----- Inisialisasi -----
window.addEventListener('load', () => {
  initCharts();
  renderLEDs();
  updateSensorUI(25, 60, "GELAP");
  updateCircularProgress("tempCircleFill", 50);
  updateCircularProgress("humCircleFill", 60);
  updateCircularProgress("ldrCircleFill", 88);
  updateCircularGradients('dark');
  initMQTT();

  // Reveal on scroll logic
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  revealElements.forEach(el => revealObserver.observe(el));

  setTimeout(() => {
    if (historyData.length === 0) {
      historyData.push({ time: "--:--:--", temp: "25.0", hum: 60, ldr: "Terang" });
      renderHistoryFull();
    }
  }, 500);
});
