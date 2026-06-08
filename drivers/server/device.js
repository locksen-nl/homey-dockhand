'use strict';

const Homey = require('homey');
const DockhandClient = require('../../lib/DockhandClient');

const UPDATE_CHECK_INTERVAL = 3600 * 1000; // 1 hour

class DockhandServerDevice extends Homey.Device {
  async onInit() {
    this._client = null;
    this._pollInterval = null;
    this._updateInterval = null;
    this._containers = [];
    this._prevStates = {};
    this._prevUnhealthyIds = new Set();
    this._wasOffline = false;
    this._firstPoll = true;

    const stored = await this.getStoreValue('knownUpdates') || [];
    this._prevUpdates = new Set(stored);

    try {
      await this._initClient();
      await this._poll();
    } catch (err) {
      this.error('onInit failed:', err.message);
    }
    this._startPolling();
    this._startUpdateChecking();
  }

  async _initClient() {
    const settings = this.getSettings();
    try {
      this._client = new DockhandClient({
        url:      settings.url,
        username: settings.username,
        password: settings.password,
      });
      if (settings.username) await this._client.login();
      await this.setAvailable();
    } catch (err) {
      this.error('Client init failed:', err.message);
      this._client = null;
    }
  }

  _startPolling() {
    if (this._pollInterval) this.homey.clearInterval(this._pollInterval);
    const interval = Math.max(10, this.getSetting('poll_interval') || 30) * 1000;
    this._pollInterval = this.homey.setInterval(() => this._poll(), interval);
  }

  _startUpdateChecking() {
    if (this._updateInterval) this.homey.clearInterval(this._updateInterval);
    this._updateInterval = this.homey.setInterval(() => this._checkUpdates(), UPDATE_CHECK_INTERVAL);
    // Run first check after 1 minute so it doesn't block startup
    this.homey.setTimeout(() => this._checkUpdates(), 60 * 1000);
  }

  async _poll() {
    if (!this._client) {
      await this._initClient();
      if (!this._client) return;
    }

    try {
      const envId = this.getSetting('endpoint_id') || 1;
      const raw = await this._client.getContainers(envId);

      this._containers = raw.map((c) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        status: c.status || '',
        image: (c.image || '').split(':')[0],
      }));

      if (!this._firstPoll) {
        await this._detectStateChanges().catch(this.error.bind(this));
      }
      this._firstPoll = false;

      this._containers.forEach((c) => { this._prevStates[c.id] = c.state; });

      const running = this._containers.filter((c) => c.state === 'running').length;
      await this.setCapabilityValue('measure_containers_running', running).catch(this.error.bind(this));
      await this.setCapabilityValue('measure_containers_total', this._containers.length).catch(this.error.bind(this));
      await this.setCapabilityValue('alarm_generic', false).catch(this.error.bind(this));
      await this.setAvailable();
      this._wasOffline = false;
    } catch (err) {
      this.error('Poll failed:', err.message);
      this._client = null;

      if (!this._wasOffline) {
        this._wasOffline = true;
        this.driver.triggerServerOffline(this).catch(this.error.bind(this));
      }

      await this.setCapabilityValue('alarm_generic', true).catch(this.error.bind(this));
      await this.setUnavailable(`${this.homey.__('error.poll_failed')} (${err.message})`);
    }
  }

  async _checkUpdates() {
    if (!this._client) return;
    try {
      const envId = this.getSetting('endpoint_id') || 1;
      const raw = await this._client.getContainerUpdates(envId);
      const updates = Array.isArray(raw) ? raw : (raw?.pendingUpdates ?? []);

      for (const item of updates) {
        const id = item.id || item.containerId;
        const name = item.name || item.containerName || id;
        if (id && !this._prevUpdates.has(id)) {
          await this.driver.triggerContainerUpdateAvailable(this, name).catch(this.error.bind(this));
        }
      }

      this._prevUpdates = new Set(updates.map((c) => c.id || c.containerId).filter(Boolean));
      await this.setStoreValue('knownUpdates', [...this._prevUpdates]).catch(this.error.bind(this));
      await this.setCapabilityValue('measure_updates_available', updates.length).catch(this.error.bind(this));
    } catch (err) {
      this.error('Update check failed:', err.message);
    }
  }

  async _detectStateChanges() {
    const currentUnhealthyIds = new Set();

    for (const container of this._containers) {
      if (container.name.endsWith('-old')) continue;

      const prev = this._prevStates[container.id];

      const isCrashed = container.state === 'exited'
        && container.status
        && container.status.includes('(')
        && !container.status.includes('(0)');

      const isUnhealthy = container.state === 'unhealthy'
        || (container.status && container.status.toLowerCase().includes('unhealthy'));

      if (isUnhealthy) currentUnhealthyIds.add(container.id);

      if (prev === undefined) continue;

      if (prev !== 'running' && container.state === 'running') {
        await this.driver.triggerContainerStarted(this, container.name).catch(this.error.bind(this));
      } else if (prev === 'running' && isCrashed) {
        await this.driver.triggerContainerCrashed(this, container.name).catch(this.error.bind(this));
      } else if (prev === 'running' && container.state !== 'running') {
        await this.driver.triggerContainerStopped(this, container.name).catch(this.error.bind(this));
      }

      if (isUnhealthy && !this._prevUnhealthyIds.has(container.id)) {
        await this.driver.triggerContainerUnhealthy(this, container.name).catch(this.error.bind(this));
      }
    }

    this._prevUnhealthyIds = currentUnhealthyIds;
  }

  getContainers() {
    return this._containers.slice();
  }

  async getDashboardStats() {
    if (!this._client) return null;
    const envId = this.getSetting('endpoint_id') || 1;
    return this._client.getDashboardStats(envId);
  }

  async controlContainer(containerId, action) {
    if (!this._client) throw new Error(this.homey.__('error.not_connected'));
    const envId = this.getSetting('endpoint_id') || 1;

    if (action === 'start') await this._client.startContainer(envId, containerId);
    else if (action === 'stop') await this._client.stopContainer(envId, containerId);
    else if (action === 'restart') await this._client.restartContainer(envId, containerId);
    else throw new Error(`Unknown action: ${action}`);

    this.homey.setTimeout(() => this._poll(), 1000);
  }

  async onSettings({ newSettings, changedKeys }) {
    const reconnectKeys = ['url', 'username', 'password', 'endpoint_id'];
    if (changedKeys.some((k) => reconnectKeys.includes(k))) {
      this._client = null;
      await this._initClient();
      await this._poll();
    }
    if (changedKeys.includes('poll_interval')) {
      this._startPolling();
    }
  }

  async onDeleted() {
    if (this._pollInterval) this.homey.clearInterval(this._pollInterval);
    if (this._updateInterval) this.homey.clearInterval(this._updateInterval);
  }
}

module.exports = DockhandServerDevice;
