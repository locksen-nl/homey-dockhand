'use strict';

const https = require('https');
const http = require('http');

class DockhandClient {
  constructor({ url, username, password }) {
    this.baseUrl = url.replace(/\/$/, '');
    this.username = username || '';
    this.password = password || '';
    this._cookie = null;
  }

  _request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const fullUrl = new URL(`/api${path}`, this.baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      const method = options.method || 'GET';
      const body = options.body ? JSON.stringify(options.body) : null;

      const headers = {
        'Accept': 'application/json',
        ...(this._cookie ? { 'Cookie': this._cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      };

      const reqOptions = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method,
        headers,
        rejectUnauthorized: false,
      };

      const req = lib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 401) {
            const err = new Error('HTTP 401: session expired or invalid credentials');
            err.status = 401;
            reject(err);
            return;
          }
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
            return;
          }
          if (res.statusCode === 204 || !data) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  // Retries once after re-login on 401.
  async _requestWithRetry(path, options = {}) {
    try {
      return await this._request(path, options);
    } catch (err) {
      if (err.status === 401 && this.username) {
        this._cookie = null;
        await this.login();
        return this._request(path, options);
      }
      throw err;
    }
  }

  _requestSSE(path) {
    return new Promise((resolve, reject) => {
      const fullUrl = new URL(`/api${path}`, this.baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const reqOptions = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          ...(this._cookie ? { 'Cookie': this._cookie } : {}),
        },
        rejectUnauthorized: false,
      };

      const req = lib.request(reqOptions, (res) => {
        if (res.statusCode >= 400) {
          let errData = '';
          res.on('data', (chunk) => { errData += chunk; });
          res.on('end', () => {
            const err = new Error(`HTTP ${res.statusCode}: ${errData || res.statusMessage}`);
            if (res.statusCode === 401) err.status = 401;
            reject(err);
          });
          return;
        }

        let buffer = '';
        let settled = false;

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'done' && !settled) {
                settled = true;
                if (parsed.success === false) {
                  reject(new Error(parsed.error || 'Operation failed'));
                } else {
                  resolve();
                }
              }
            } catch {
              // ignore non-JSON SSE lines
            }
          }
        });

        res.on('end', () => {
          if (!settled) resolve();
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async _requestSSEWithRetry(path) {
    try {
      return await this._requestSSE(path);
    } catch (err) {
      if (err.status === 401 && this.username) {
        this._cookie = null;
        await this.login();
        return this._requestSSE(path);
      }
      throw err;
    }
  }

  async _getDefaultProvider() {
    try {
      const result = await this._request('/auth/providers');
      return (result && result.defaultProvider) ? result.defaultProvider : 'local';
    } catch {
      return 'local';
    }
  }

  async login() {
    const provider = await this._getDefaultProvider();
    return new Promise((resolve, reject) => {
      const fullUrl = new URL('/api/auth/login', this.baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      const body = JSON.stringify({ username: this.username, password: this.password, provider });

      const reqOptions = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: false,
      };

      const req = lib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Login failed (${res.statusCode}): ${data || res.statusMessage}`));
            return;
          }
          const cookies = res.headers['set-cookie'] || [];
          const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
          if (!cookie) {
            // No auth enabled — proceed without cookie
            resolve();
            return;
          }
          this._cookie = cookie;
          resolve();
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // Logs in first if credentials are set, then tests the connection.
  async testConnection() {
    if (this.username) await this.login();
    return this._request('/environments');
  }

  async getEnvironments() {
    return this._requestWithRetry('/environments');
  }

  async getContainers(envId) {
    return this._requestWithRetry(`/containers?env=${envId}`);
  }

  async getDashboardStats(envId) {
    return this._requestWithRetry(`/dashboard/stats?env=${envId}`);
  }

  async getContainerUpdates(envId) {
    return this._requestWithRetry(`/containers/updates?env=${envId}`);
  }

  async startContainer(envId, containerId) {
    return this._requestSSEWithRetry(`/containers/${containerId}/start?env=${envId}`);
  }

  async stopContainer(envId, containerId) {
    return this._requestSSEWithRetry(`/containers/${containerId}/stop?env=${envId}`);
  }

  async restartContainer(envId, containerId) {
    return this._requestSSEWithRetry(`/containers/${containerId}/restart?env=${envId}`);
  }
}

module.exports = DockhandClient;
