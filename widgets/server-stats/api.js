'use strict';

module.exports = {
  async getStats({ homey }) {
    try {
      const devices = homey.app.getServerDevices();

      if (!devices.length) {
        return { connected: false, servers: [], devices: [] };
      }

      const deviceList = devices.map((d) => ({
        id: d.getData().id,
        name: d.getName(),
        connected: d.getAvailable(),
      }));

      const servers = [];
      for (const device of devices) {
        const deviceId = device.getData().id;
        const deviceName = device.getName();
        const connected = device.getAvailable();

        let stats = null;
        if (connected) {
          try {
            stats = await device.getDashboardStats();
          } catch (err) {
            // stats stays null
          }
        }

        servers.push({ deviceId, deviceName, connected, stats });
      }

      return {
        connected: devices.some((d) => d.getAvailable()),
        servers,
        devices: deviceList,
      };
    } catch (err) {
      return { connected: false, servers: [], devices: [], error: err.message };
    }
  },
};
