/**
 * 平台适配器
 * 提供平台无关的接口和标准化的平台抽象
 */

import { logger } from '../../shared/utils/logger.js';
import { ErrorHandlerUtils } from '../../shared/utils/ErrorHandlerUtils.js';

export class PlatformAdapter {
  constructor(options = {}) {
    this.options = {
      autoDetect: true,
      fallbackPlatform: 'node',
      enablePolyfills: true,
      ...options
    };

    // 平台信息
    this.platform = null;
    this.version = null;
    this.capabilities = new Set();

    // 适配器注册表
    this.adapters = new Map();

    // 平台特定的实现
    this.implementations = new Map();

    // 初始化
    this._initialize();

    logger.info('Platform adapter initialized', {
      autoDetect: this.options.autoDetect,
      fallbackPlatform: this.options.fallbackPlatform
    });
  }

  /**
   * 检测当前平台
   * @returns {string} 平台名称
   */
  detectPlatform() {
    if (this.platform) return this.platform;

    // 检测逻辑
    if (this._isNodeJS()) {
      this.platform = 'node';
      this.version = process.version;
    } else if (this._isBrowser()) {
      this.platform = 'browser';
      this.version = navigator.userAgent;
    } else if (this._isDeno()) {
      this.platform = 'deno';
      this.version = Deno.version.deno;
    } else if (this._isBun()) {
      this.platform = 'bun';
      this.version = Bun.version;
    } else if (this._isElectron()) {
      this.platform = 'electron';
      this.version = process.version;
    } else if (this._isReactNative()) {
      this.platform = 'react-native';
      this.version = 'unknown';
    } else {
      this.platform = this.options.fallbackPlatform;
      this.version = 'unknown';
    }

    // 检测平台能力
    this._detectCapabilities();

    logger.info('Platform detected', {
      platform: this.platform,
      version: this.version,
      capabilities: Array.from(this.capabilities)
    });

    return this.platform;
  }

  /**
   * 注册平台适配器
   * @param {string} platform - 平台名称
   * @param {Object} adapter - 适配器实现
   */
  registerAdapter(platform, adapter) {
    this.adapters.set(platform, adapter);
    logger.debug(`Platform adapter registered: ${platform}`);
  }

  /**
   * 获取平台特定的实现
   * @param {string} api - API名称
   * @param {Object} options - 获取选项
   * @returns {*} 平台实现
   */
  getImplementation(api, options = {}) {
    const { platform = this.detectPlatform(), fallback = true } = options;

    // 首先尝试获取平台特定的实现
    const platformImpl = this.implementations.get(`${platform}:${api}`);
    if (platformImpl) {
      return platformImpl;
    }

    // 尝试获取通用实现
    const genericImpl = this.implementations.get(`generic:${api}`);
    if (genericImpl) {
      return genericImpl;
    }

    // 如果启用了fallback，尝试其他平台的实现
    if (fallback) {
      for (const [key, impl] of this.implementations) {
        if (key.endsWith(`:${api}`)) {
          logger.debug(`Using fallback implementation for ${api}: ${key}`);
          return impl;
        }
      }
    }

    // 如果都没有找到，抛出错误
    throw new Error(`No implementation found for API: ${api} on platform: ${platform}`);
  }

  /**
   * 注册API实现
   * @param {string} api - API名称
   * @param {Function} implementation - 实现函数
   * @param {Object} options - 注册选项
   */
  registerImplementation(api, implementation, options = {}) {
    const { platforms = ['generic'], priority = 0 } = options;

    for (const platform of platforms) {
      const key = `${platform}:${api}`;
      const existing = this.implementations.get(key);

      if (!existing || options.priority > (existing.priority || 0)) {
        this.implementations.set(key, {
          implementation,
          platform,
          priority,
          registeredAt: Date.now()
        });

        logger.debug(`API implementation registered: ${key}`);
      }
    }
  }

  /**
   * 调用平台API
   * @param {string} api - API名称
   * @param {*} args - 调用参数
   * @param {Object} options - 调用选项
   * @returns {Promise<*>} 调用结果
   */
  async call(api, args = [], options = {}) {
    try {
      const impl = this.getImplementation(api, options);

      if (typeof impl.implementation !== 'function') {
        throw new Error(`Implementation for ${api} is not a function`);
      }

      // 如果实现是异步的
      if (impl.implementation.constructor.name === 'AsyncFunction') {
        return await impl.implementation(...args);
      }

      // 同步调用
      return impl.implementation(...args);

    } catch (error) {
      logger.error(`Platform API call failed: ${api}`, {
        error: error.message,
        platform: this.platform
      });
      throw error;
    }
  }

  /**
   * 检查平台能力
   * @param {string} capability - 能力名称
   * @returns {boolean}
   */
  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  /**
   * 获取平台信息
   * @returns {Object}
   */
  getPlatformInfo() {
    return {
      name: this.platform || this.detectPlatform(),
      version: this.version,
      capabilities: Array.from(this.capabilities),
      isNode: this._isNodeJS(),
      isBrowser: this._isBrowser(),
      isDeno: this._isDeno(),
      isBun: this._isBun(),
      isElectron: this._isElectron(),
      isReactNative: this._isReactNative(),
      adapters: Array.from(this.adapters.keys()),
      implementations: this._getImplementationStats()
    };
  }

  /**
   * 创建文件系统适配器
   * @returns {Object} 文件系统接口
   */
  createFileSystemAdapter() {
    return this._createAdapter('fs', {
      readFile: async (path, options = {}) => {
        return this.call('fs.readFile', [path, options]);
      },
      writeFile: async (path, content, options = {}) => {
        return this.call('fs.writeFile', [path, content, options]);
      },
      exists: async (path) => {
        return this.call('fs.exists', [path]);
      },
      stat: async (path) => {
        return this.call('fs.stat', [path]);
      },
      mkdir: async (path, options = {}) => {
        return this.call('fs.mkdir', [path, options]);
      },
      readdir: async (path) => {
        return this.call('fs.readdir', [path]);
      },
      unlink: async (path) => {
        return this.call('fs.unlink', [path]);
      },
      copyFile: async (src, dest) => {
        return this.call('fs.copyFile', [src, dest]);
      }
    });
  }

  /**
   * 创建网络适配器
   * @returns {Object} 网络接口
   */
  createNetworkAdapter() {
    return this._createAdapter('net', {
      request: async (url, options = {}) => {
        return this.call('net.request', [url, options]);
      },
      createServer: (options, handler) => {
        return this.call('net.createServer', [options, handler]);
      },
      connect: (options) => {
        return this.call('net.connect', [options]);
      }
    });
  }

  /**
   * 创建存储适配器
   * @returns {Object} 存储接口
   */
  createStorageAdapter() {
    return this._createAdapter('storage', {
      get: async (key) => {
        return this.call('storage.get', [key]);
      },
      set: async (key, value) => {
        return this.call('storage.set', [key, value]);
      },
      remove: async (key) => {
        return this.call('storage.remove', [key]);
      },
      clear: async () => {
        return this.call('storage.clear', []);
      },
      keys: async () => {
        return this.call('storage.keys', []);
      }
    });
  }

  /**
   * 创建加密适配器
   * @returns {Object} 加密接口
   */
  createCryptoAdapter() {
    return this._createAdapter('crypto', {
      hash: (algorithm, data) => {
        return this.call('crypto.hash', [algorithm, data]);
      },
      randomBytes: (size) => {
        return this.call('crypto.randomBytes', [size]);
      },
      encrypt: (algorithm, key, data) => {
        return this.call('crypto.encrypt', [algorithm, key, data]);
      },
      decrypt: (algorithm, key, data) => {
        return this.call('crypto.decrypt', [algorithm, key, data]);
      }
    });
  }

  /**
   * 创建进程适配器
   * @returns {Object} 进程接口
   */
  createProcessAdapter() {
    return this._createAdapter('process', {
      exec: async (command, options = {}) => {
        return this.call('process.exec', [command, options]);
      },
      spawn: (command, args, options = {}) => {
        return this.call('process.spawn', [command, args, options]);
      },
      env: () => {
        return this.call('process.env', []);
      },
      cwd: () => {
        return this.call('process.cwd', []);
      },
      exit: (code = 0) => {
        return this.call('process.exit', [code]);
      }
    });
  }

  /**
   * 初始化平台适配器
   */
  _initialize() {
    // 注册默认适配器
    this._registerDefaultAdapters();

    // 注册平台特定的实现
    this._registerPlatformImplementations();

    // 如果启用了自动检测，立即检测平台
    if (this.options.autoDetect) {
      this.detectPlatform();
    }
  }

  /**
   * 注册默认适配器
   */
  _registerDefaultAdapters() {
    // Node.js适配器
    this.registerAdapter('node', {
      name: 'NodeJSAdapter',
      version: '1.0.0',
      capabilities: ['fs', 'net', 'crypto', 'process', 'child_process']
    });

    // 浏览器适配器
    this.registerAdapter('browser', {
      name: 'BrowserAdapter',
      version: '1.0.0',
      capabilities: ['fetch', 'localStorage', 'crypto', 'webcrypto']
    });

    // Deno适配器
    this.registerAdapter('deno', {
      name: 'DenoAdapter',
      version: '1.0.0',
      capabilities: ['fs', 'net', 'crypto', 'fetch']
    });

    // Bun适配器
    this.registerAdapter('bun', {
      name: 'BunAdapter',
      version: '1.0.0',
      capabilities: ['fs', 'net', 'crypto', 'fetch']
    });
  }

  /**
   * 注册平台特定的实现
   */
  _registerPlatformImplementations() {
    // 文件系统实现
    this.registerImplementation('fs.readFile', async (path, options = {}) => {
      if (this._isNodeJS()) {
        const fs = require('fs/promises');
        return await fs.readFile(path, options);
      } else if (this._isDeno()) {
        return await Deno.readFile(path);
      } else if (this._isBun()) {
        const fs = require('fs/promises');
        return await fs.readFile(path, options);
      }
      throw new Error('File system not supported on this platform');
    }, { platforms: ['node', 'deno', 'bun'] });

    this.registerImplementation('fs.writeFile', async (path, content, options = {}) => {
      if (this._isNodeJS()) {
        const fs = require('fs/promises');
        return await fs.writeFile(path, content, options);
      } else if (this._isDeno()) {
        return await Deno.writeFile(path, content);
      } else if (this._isBun()) {
        const fs = require('fs/promises');
        return await fs.writeFile(path, content, options);
      }
      throw new Error('File system not supported on this platform');
    }, { platforms: ['node', 'deno', 'bun'] });

    // 网络请求实现
    this.registerImplementation('net.request', async (url, options = {}) => {
      if (this._isNodeJS() || this._isBun()) {
        const https = require('https');
        const http = require('http');
        return new Promise((resolve, reject) => {
          const req = (url.startsWith('https:') ? https : http).request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
          });
          req.on('error', reject);
          req.end();
        });
      } else if (this._isBrowser() || this._isDeno()) {
        const response = await fetch(url, options);
        const data = await response.text();
        return { status: response.status, data };
      }
      throw new Error('Network requests not supported on this platform');
    }, { platforms: ['node', 'browser', 'deno', 'bun'] });

    // 加密实现
    this.registerImplementation('crypto.hash', (algorithm, data) => {
      if (this._isNodeJS() || this._isBun()) {
        const crypto = require('crypto');
        return crypto.createHash(algorithm).update(data).digest('hex');
      } else if (this._isBrowser()) {
        // 使用Web Crypto API
        return crypto.subtle.digest(algorithm, data).then(buffer => {
          return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        });
      } else if (this._isDeno()) {
        return crypto.subtle.digest(algorithm, data).then(buffer => {
          return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        });
      }
      throw new Error('Crypto not supported on this platform');
    }, { platforms: ['node', 'browser', 'deno', 'bun'] });

    // 存储实现
    this.registerImplementation('storage.get', async (key) => {
      if (this._isBrowser()) {
        return localStorage.getItem(key);
      } else if (this._isNodeJS() || this._isDeno() || this._isBun()) {
        // 使用文件系统作为存储
        try {
          const fs = this._isDeno() ? Deno : require('fs/promises');
          const data = await fs.readFile(`.storage/${key}`, 'utf8');
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
      return null;
    }, { platforms: ['node', 'browser', 'deno', 'bun'] });

    this.registerImplementation('storage.set', async (key, value) => {
      if (this._isBrowser()) {
        localStorage.setItem(key, JSON.stringify(value));
      } else if (this._isNodeJS() || this._isBun()) {
        const fs = require('fs/promises');
        await fs.mkdir('.storage', { recursive: true });
        await fs.writeFile(`.storage/${key}`, JSON.stringify(value));
      } else if (this._isDeno()) {
        await Deno.mkdir('.storage', { recursive: true });
        await Deno.writeFile(`.storage/${key}`, JSON.stringify(value));
      }
    }, { platforms: ['node', 'browser', 'deno', 'bun'] });
  }

  /**
   * 检测平台能力
   */
  _detectCapabilities() {
    const capabilities = [];

    if (this._isNodeJS()) {
      capabilities.push('fs', 'net', 'crypto', 'process', 'child_process', 'cluster');
    } else if (this._isBrowser()) {
      capabilities.push('fetch', 'localStorage', 'sessionStorage', 'webcrypto', 'websockets');
    } else if (this._isDeno()) {
      capabilities.push('fs', 'net', 'crypto', 'fetch', 'websockets');
    } else if (this._isBun()) {
      capabilities.push('fs', 'net', 'crypto', 'fetch', 'websockets');
    }

    this.capabilities = new Set(capabilities);
  }

  /**
   * 创建适配器
   */
  _createAdapter(name, methods) {
    const adapter = {};

    for (const [methodName, methodImpl] of Object.entries(methods)) {
      adapter[methodName] = async (...args) => {
        try {
          return await methodImpl(...args);
        } catch (error) {
          logger.error(`Adapter method failed: ${name}.${methodName}`, {
            error: error.message
          });
          throw error;
        }
      };
    }

    return adapter;
  }

  /**
   * 获取实现统计信息
   */
  _getImplementationStats() {
    const stats = {};

    for (const [key] of this.implementations) {
      const [platform, api] = key.split(':');
      if (!stats[platform]) stats[platform] = {};
      stats[platform][api] = true;
    }

    return stats;
  }

  /**
   * 平台检测方法
   */
  _isNodeJS() {
    return typeof process !== 'undefined' &&
           process.versions != null &&
           process.versions.node != null;
  }

  _isBrowser() {
    return typeof window !== 'undefined' &&
           typeof document !== 'undefined';
  }

  _isDeno() {
    return typeof Deno !== 'undefined' &&
           typeof Deno.version !== 'undefined' &&
           typeof Deno.version.deno !== 'undefined';
  }

  _isBun() {
    return typeof Bun !== 'undefined' &&
           typeof Bun.version !== 'undefined';
  }

  _isElectron() {
    return this._isNodeJS() &&
           typeof process !== 'undefined' &&
           process.versions.electron != null;
  }

  _isReactNative() {
    return typeof navigator !== 'undefined' &&
           navigator.product === 'ReactNative';
  }
}

/**
 * 创建平台适配器的工厂函数
 * @param {Object} options - 选项
 * @returns {PlatformAdapter}
 */
export function createPlatformAdapter(options = {}) {
  return new PlatformAdapter(options);
}

/**
 * 获取当前平台的便捷函数
 * @returns {string}
 */
export function getCurrentPlatform() {
  const adapter = new PlatformAdapter({ autoDetect: true });
  return adapter.detectPlatform();
}

/**
 * 检查平台能力的便捷函数
 * @param {string} capability - 能力名称
 * @returns {boolean}
 */
export function hasPlatformCapability(capability) {
  const adapter = new PlatformAdapter({ autoDetect: true });
  return adapter.hasCapability(capability);
}
