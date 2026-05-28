'use strict';

const Homey = require('homey');
const DockhandClient = require('../../lib/DockhandClient');

class DockhandServerDriver extends Homey.Driver {

  async onInit() {
    this.log('Dockhand Server driver initialized');
    try {
      this._registerFlowCards();
    } catch (err) {
      this.error('Flow card registration failed:', err.message);
    }
  }

  _registerFlowCards() {
    this._triggerContainerStarted        = this.homey.flow.getDeviceTriggerCard('container_started');
    this._triggerContainerStopped        = this.homey.flow.getDeviceTriggerCard('container_stopped');
    this._triggerContainerCrashed        = this.homey.flow.getDeviceTriggerCard('container_crashed');
    this._triggerServerOffline           = this.homey.flow.getDeviceTriggerCard('server_offline');
    this._triggerContainerUpdateAvailable = this.homey.flow.getDeviceTriggerCard('container_update_available');

    this.homey.flow.getConditionCard('container_is_running')
      .registerRunListener(async ({ device, container }) => {
        const found = device.getContainers().find((c) => c.id === container.id);
        return found ? found.state === 'running' : false;
      })
      .registerArgumentAutocompleteListener('container', async (query, { device }) => {
        return this._autocomplete(query, device);
      });

    this.homey.flow.getActionCard('container_start')
      .registerRunListener(async ({ device, container }) => {
        await device.controlContainer(container.id, 'start');
      })
      .registerArgumentAutocompleteListener('container', async (query, { device }) => {
        return this._autocomplete(query, device, 'stopped');
      });

    this.homey.flow.getActionCard('container_stop')
      .registerRunListener(async ({ device, container }) => {
        await device.controlContainer(container.id, 'stop');
      })
      .registerArgumentAutocompleteListener('container', async (query, { device }) => {
        return this._autocomplete(query, device, 'running');
      });

    this.homey.flow.getActionCard('container_restart')
      .registerRunListener(async ({ device, container }) => {
        await device.controlContainer(container.id, 'restart');
      })
      .registerArgumentAutocompleteListener('container', async (query, { device }) => {
        return this._autocomplete(query, device);
      });
  }

  _autocomplete(query, device, filterState = null) {
    let list = device.getContainers();
    if (filterState === 'running') list = list.filter((c) => c.state === 'running');
    if (filterState === 'stopped') list = list.filter((c) => c.state !== 'running');
    return list
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .map((c) => ({ id: c.id, name: c.name, description: c.image }));
  }

  async onPair(session) {
    let savedUrl      = '';
    let savedUsername = '';
    let savedPassword = '';

    session.setHandler('validate', async ({ url, username, password }) => {
      const client = new DockhandClient({ url, username, password });
      await client.testConnection();
      savedUrl      = url;
      savedUsername = username || '';
      savedPassword = password || '';
    });

    session.setHandler('list_devices', async () => {
      const client = new DockhandClient({ url: savedUrl, username: savedUsername, password: savedPassword });
      const envs   = await client.getEnvironments();

      return envs.map((env) => {
        const id   = env.id ?? env.Id;
        const name = env.name || env.Name || `Environment ${id}`;
        return {
          name,
          data: { id: `server-${id}` },
          settings: {
            url:           savedUrl,
            username:      savedUsername,
            password:      savedPassword,
            endpoint_id:   id,
            poll_interval: 30,
          },
        };
      });
    });
  }

  async triggerContainerStarted(device, containerName) {
    return this._triggerContainerStarted.trigger(device, { container_name: containerName }, {});
  }

  async triggerContainerStopped(device, containerName) {
    return this._triggerContainerStopped.trigger(device, { container_name: containerName }, {});
  }

  async triggerContainerCrashed(device, containerName) {
    return this._triggerContainerCrashed.trigger(device, { container_name: containerName }, {});
  }

  async triggerServerOffline(device) {
    return this._triggerServerOffline.trigger(device, {}, {});
  }

  async triggerContainerUpdateAvailable(device, containerName) {
    return this._triggerContainerUpdateAvailable.trigger(device, { container_name: containerName }, {});
  }

}

module.exports = DockhandServerDriver;
