'use strict';

module.exports = {
  async getContainers({ homey }) {
    try {
      const devices = homey.app.getServerDevices();

      if (!devices.length) {
        return { connected: false, containers: [], devices: [] };
      }

      const deviceList = devices.map((d) => ({
        id: d.getData().id,
        name: d.getName(),
        connected: d.getAvailable(),
      }));

      const allContainers = [];
      for (const device of devices) {
        const deviceId = device.getData().id;
        const deviceName = device.getName();
        device.getContainers().forEach((c) => {
          allContainers.push({ ...c, deviceId, deviceName });
        });
      }

      return {
        connected: devices.some((d) => d.getAvailable()),
        containers: allContainers,
        devices: deviceList,
      };
    } catch (err) {
      return { connected: false, containers: [], devices: [], error: err.message };
    }
  },

  async controlContainer({ homey, body }) {
    const { containerId, action, deviceId } = body;

    if (!containerId || !action) {
      throw new Error('Missing containerId or action');
    }

    const devices = homey.app.getServerDevices();
    if (!devices.length) throw new Error('No Dockhand device found');

    const device = (deviceId && devices.find((d) => d.getData().id === deviceId)) || devices[0];
    await device.controlContainer(containerId, action);
    return { success: true };
  },
};
