'use strict';

const REFRESH_MS = 30000;

let servers = [];
let devices = [];
let refreshTimer = null;
let lastRefreshAt = null;
let selectedDeviceId = 'all';

function fmt(bytes) {
  if (bytes == null) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`;
}

function pct(val) {
  if (val == null) return 0;
  return Math.min(100, Math.max(0, Math.round(val)));
}

function barClass(p) {
  if (p >= 90) return 'danger';
  if (p >= 70) return 'warn';
  return '';
}

async function refresh() {
  try {
    const data = await window.Homey.api('GET', '/stats');
    servers = data.servers || [];
    devices = data.devices || [];
    lastRefreshAt = Date.now();
    renderEnvBar();
    render();
    updateFooter();
  } catch (err) {
    document.getElementById('content').innerHTML = '<div class="placeholder">Could not load stats</div>';
  }
}

function updateFooter() {
  const el = document.getElementById('footer');
  if (!el || !lastRefreshAt) return;
  const s = Math.round((Date.now() - lastRefreshAt) / 1000);
  el.textContent = s < 10 ? 'Just updated' : `Updated ${s}s ago`;
}

function renderEnvBar() {
  const bar = document.getElementById('env-bar');
  const wrap = document.getElementById('env-bar-wrap');
  if (!bar || !wrap) return;

  if (devices.length <= 1) { wrap.style.display = 'none'; return; }

  wrap.style.display = '';
  bar.innerHTML = '';

  devices.forEach((dev) => {
    const btn = document.createElement('button');
    btn.className = `env-btn${selectedDeviceId === dev.id ? ' active' : ''}${!dev.connected ? ' offline' : ''}`;
    btn.textContent = dev.name;
    btn.onclick = () => { selectedDeviceId = dev.id; renderEnvBar(); render(); };
    bar.appendChild(btn);
  });
}

function render() {
  const content = document.getElementById('content');
  const summaryEl = document.getElementById('summary');

  const visible = selectedDeviceId === 'all'
    ? servers
    : servers.filter((s) => s.deviceId === selectedDeviceId);

  const connectedCount = visible.filter((s) => s.connected).length;
  summaryEl.textContent = `${connectedCount} / ${visible.length}`;

  if (!visible.length) {
    content.innerHTML = '<div class="placeholder">No servers found</div>';
    return;
  }

  content.innerHTML = '';

  for (const server of visible) {
    const block = document.createElement('div');
    block.className = 'stat-block';

    if (devices.length > 1 && selectedDeviceId === 'all') {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;font-weight:700;color:var(--brand);margin-bottom:2px';
      label.textContent = server.deviceName;
      block.appendChild(label);
    }

    if (!server.connected || !server.stats) {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:11px;color:var(--text-sub);padding:4px 0';
      msg.textContent = server.connected ? 'No data available' : 'Offline';
      block.appendChild(msg);
      content.appendChild(block);
      continue;
    }

    const metrics = server.stats.metrics || {};
    const containers = server.stats.containers || {};

    // CPU
    const cpuPct = pct(metrics.cpuPercent);
    block.appendChild(makeStatRow('CPU', cpuPct, `${cpuPct}%`));

    // Memory
    const memPct = pct(metrics.memoryPercent);
    const memLabel = `${fmt(metrics.memoryUsed)} / ${fmt(metrics.memoryTotal)}`;
    block.appendChild(makeStatRow('RAM', memPct, memLabel));

    // Containers
    if (containers.total != null) {
      block.appendChild(makeContainersRow(containers));
    }

    content.appendChild(block);
  }
}

function makeStatRow(label, percent, valueText) {
  const row = document.createElement('div');
  row.className = 'stat-row';

  const lbl = document.createElement('div');
  lbl.className = 'stat-label';
  lbl.textContent = label;

  const barWrap = document.createElement('div');
  barWrap.className = 'stat-bar-wrap';
  const bar = document.createElement('div');
  bar.className = `stat-bar ${barClass(percent)}`.trim();
  bar.style.width = `${percent}%`;
  barWrap.appendChild(bar);

  const val = document.createElement('div');
  val.className = 'stat-value';
  val.textContent = valueText;

  row.appendChild(lbl);
  row.appendChild(barWrap);
  row.appendChild(val);
  return row;
}

function makeContainersRow(containers) {
  const row = document.createElement('div');
  row.className = 'containers-row';

  const lbl = document.createElement('div');
  lbl.className = 'containers-label';
  lbl.textContent = 'Docker';

  const pills = document.createElement('div');
  pills.className = 'containers-pills';

  if (containers.running) {
    const p = document.createElement('span');
    p.className = 'pill running';
    p.textContent = `${containers.running} running`;
    pills.appendChild(p);
  }
  const stopped = (containers.stopped || 0) + (containers.paused || 0);
  if (stopped) {
    const p = document.createElement('span');
    p.className = 'pill stopped';
    p.textContent = `${stopped} stopped`;
    pills.appendChild(p);
  }

  row.appendChild(lbl);
  row.appendChild(pills);
  return row;
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    await refresh();
    scheduleRefresh();
  }, REFRESH_MS);
}

(function waitForHomey() {
  if (window.Homey) {
    window.Homey.ready();
    setInterval(updateFooter, 10000);
    refresh().then(scheduleRefresh).catch(() => {
      document.getElementById('content').innerHTML = '<div class="placeholder">Could not load stats</div>';
    });
  } else {
    setTimeout(waitForHomey, 50);
  }
}());
