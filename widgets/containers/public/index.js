'use strict';

const REFRESH_MS = 15000;

const TRANSLATIONS = {
  nl: {
    search_placeholder: 'Zoek containers…',
    no_containers:      'Geen containers gevonden',
    not_connected:      'Server niet bereikbaar',
    error_loading:      'Kan containers niet laden',
    no_results:         'Geen resultaten',
    show_all:           'Alles',
    hide_offline:       'Verberg offline',
  },
  en: {
    search_placeholder: 'Search containers…',
    no_containers:      'No containers found',
    not_connected:      'Server unreachable',
    error_loading:      'Could not load containers',
    no_results:         'No results',
    show_all:           'All',
    hide_offline:       'Hide offline',
  },
};

function t(key) {
  const lang = (navigator.language || 'en').slice(0, 2);
  return (TRANSLATIONS[lang] || TRANSLATIONS.en)[key] || TRANSLATIONS.en[key];
}

let allContainers = [];
let devices = [];
let refreshTimer = null;
let lastRefreshAt = null;
let lastConnected = false;
let showRunningOnly = false;
let hideOffline = false;
let searchQuery = '';
let selectedDeviceId = 'all';

const SVG = {
  stop:    '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>',
  restart: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>',
  start:   '<svg viewBox="0 0 16 16" fill="currentColor"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>',
  eyeOff:  '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829"/><path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></svg>',
};

async function refresh() {
  try {
    const data = await window.Homey.api('GET', '/containers');
    allContainers = data.containers || [];
    devices = data.devices || [];
    lastConnected = data.connected;
    lastRefreshAt = Date.now();
    renderEnvBar();
    render();
    updateFooter();
  } catch (err) {
    showPlaceholder(t('error_loading'));
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

  if (devices.length <= 1) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  bar.style.display = '';
  bar.innerHTML = '';
  const existingHideBtn = wrap.querySelector('.env-hide-btn');
  if (existingHideBtn) existingHideBtn.remove();

  const allBtn = document.createElement('button');
  allBtn.className = `env-btn${selectedDeviceId === 'all' ? ' active' : ''}`;
  allBtn.textContent = t('show_all');
  allBtn.onclick = () => { selectedDeviceId = 'all'; renderEnvBar(); render(); };
  bar.appendChild(allBtn);

  devices.forEach((dev) => {
    const btn = document.createElement('button');
    btn.className = `env-btn${selectedDeviceId === dev.id ? ' active' : ''}${!dev.connected ? ' offline' : ''}`;
    btn.textContent = dev.name;
    btn.title = dev.connected ? dev.name : `${dev.name} (offline)`;
    btn.onclick = () => { selectedDeviceId = dev.id; renderEnvBar(); render(); };
    bar.appendChild(btn);
  });

  const hideBtn = document.createElement('button');
  hideBtn.className = `env-hide-btn${hideOffline ? ' active' : ''}`;
  hideBtn.innerHTML = SVG.eyeOff;
  hideBtn.title = t('hide_offline');
  hideBtn.onclick = () => { hideOffline = !hideOffline; renderEnvBar(); render(); };
  wrap.appendChild(hideBtn);
}

function render() {
  const listEl = document.getElementById('list');
  const summaryEl = document.getElementById('summary');
  const filterBtn = document.getElementById('filter-btn');
  const searchWrap = document.querySelector('.search-wrap');

  const showingAll = selectedDeviceId === 'all';
  const multiDevice = devices.length > 1;

  const connected = showingAll
    ? lastConnected
    : (devices.find((d) => d.id === selectedDeviceId)?.connected ?? false);

  let list = showingAll
    ? allContainers.slice()
    : allContainers.filter((c) => c.deviceId === selectedDeviceId);

  if (hideOffline && multiDevice) {
    list = list.filter((c) => {
      const dev = devices.find((d) => d.id === c.deviceId);
      return dev ? dev.connected : true;
    });
  }

  if (!connected || !list.length) {
    listEl.innerHTML = `<div class="placeholder">${connected ? t('no_containers') : t('not_connected')}</div>`;
    summaryEl.textContent = '—';
    searchWrap.style.display = 'none';
    return;
  }

  const running = list.filter((c) => c.state === 'running').length;
  summaryEl.textContent = `${running} / ${list.length}`;
  searchWrap.style.display = '';

  filterBtn.classList.toggle('active', showRunningOnly);

  let filtered = list.sort((a, b) => {
    if (a.state === 'running' && b.state !== 'running') return -1;
    if (a.state !== 'running' && b.state === 'running') return 1;
    return a.name.localeCompare(b.name);
  });

  if (showRunningOnly) filtered = filtered.filter((c) => c.state === 'running');
  if (searchQuery) filtered = filtered.filter((c) => c.name.toLowerCase().includes(searchQuery));

  listEl.innerHTML = '';

  if (!filtered.length) {
    listEl.innerHTML = `<div class="placeholder">${t('no_results')}</div>`;
    return;
  }

  filtered.forEach((container) => {
    const isCrashed = container.state === 'exited' && container.status && container.status.includes('(') && !container.status.includes('(0)');
    const devOffline = multiDevice && showingAll && !devices.find((d) => d.id === container.deviceId)?.connected;

    const row = document.createElement('div');
    row.className = `row ${container.state === 'running' ? 'running' : isCrashed ? 'crashed' : 'stopped'}${devOffline ? ' dev-offline' : ''}`;

    const dot = document.createElement('div');
    dot.className = `dot ${container.state}`;

    const info = document.createElement('div');
    info.className = 'row-info';

    const name = document.createElement('div');
    name.className = 'row-name';
    name.textContent = container.name;
    name.title = container.name;

    const meta = document.createElement('div');
    meta.className = 'row-meta';

    const metaItems = [];

    if (showingAll && multiDevice) {
      const badge = document.createElement('span');
      badge.className = `row-device${devOffline ? ' offline' : ''}`;
      badge.textContent = container.deviceName;
      badge.title = container.deviceName;
      metaItems.push(badge);
    }

    if (container.state === 'running') {
      const uptime = document.createElement('span');
      uptime.className = 'row-uptime';
      uptime.textContent = container.status || '';
      metaItems.push(uptime);
    } else {
      if (container.image) {
        const img = document.createElement('span');
        img.className = 'row-image';
        img.textContent = container.image;
        metaItems.push(img);
      }
      if (container.status) {
        const uptime = document.createElement('span');
        uptime.className = 'row-uptime';
        uptime.textContent = container.status;
        metaItems.push(uptime);
      }
    }

    metaItems.forEach((item, i) => {
      if (i > 0) appendSep(meta);
      meta.appendChild(item);
    });

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    if (container.state === 'running') {
      actions.appendChild(makeBtn(SVG.stop, 'stop', container.id, container.deviceId, 'btn-stop'));
      actions.appendChild(makeBtn(SVG.restart, 'restart', container.id, container.deviceId, 'btn-restart'));
    } else {
      actions.appendChild(makeBtn(SVG.start, 'start', container.id, container.deviceId, 'btn-start'));
    }

    row.appendChild(dot);
    row.appendChild(info);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

function appendSep(parent) {
  const sep = document.createElement('span');
  sep.className = 'row-sep';
  sep.textContent = '·';
  parent.appendChild(sep);
}

function makeBtn(svgHtml, action, containerId, deviceId, cls) {
  const btn = document.createElement('button');
  btn.className = `btn-action ${cls}`;
  btn.innerHTML = svgHtml;
  btn.title = action.charAt(0).toUpperCase() + action.slice(1);
  btn.onclick = () => handleAction(containerId, deviceId, action, btn);
  return btn;
}

async function handleAction(containerId, deviceId, action, btn) {
  btn.disabled = true;
  try {
    await window.Homey.api('POST', '/container', { containerId, action, deviceId });
    window.Homey.hapticFeedback();
    setTimeout(refresh, 2500);
  } catch (err) {
    btn.disabled = false;
  }
}

function showPlaceholder(msg) {
  document.getElementById('list').innerHTML = `<div class="placeholder">${msg}</div>`;
  document.getElementById('summary').textContent = '—';
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

    document.getElementById('search').placeholder = t('search_placeholder');

    document.getElementById('filter-btn').addEventListener('click', () => {
      showRunningOnly = !showRunningOnly;
      render();
    });

    document.getElementById('search').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      render();
    });

    setInterval(updateFooter, 10000);

    refresh().then(scheduleRefresh).catch(() => {
      showPlaceholder(t('error_loading'));
    });
  } else {
    setTimeout(waitForHomey, 50);
  }
}());
