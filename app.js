'use strict';

const Homey = require('homey');

class DockhandApp extends Homey.App {
  async onInit() {
    this.log('Dockhand app started');
  }

  // Called by widget api.js via homey.app
  getServerDevices() {
    const driver = this.homey.drivers.getDriver('server');
    return driver.getDevices();
  }
}

module.exports = DockhandApp;
