/**
 * 基于 Axios 的HTTP客户端
 * 使用真正的 Axios 开源库
 */

import axios from 'axios';
import { BaseModule } from './BaseModule.js';
import { frysError } from './error-handler.js';
import { logger } from '../utils/logger.js';

class AxiosInspiredHTTP extends BaseModule {
  getDefaultConfig() {
    return {
      ...super.getDefaultConfig(),
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  constructor() {
    super('http');
    this.client = null;
  }

  async onInitialize() {
    // 创建axios实例
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers,
    });

    // 添加响应拦截器用于错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('HTTP请求失败', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        throw new frysError(
          `HTTP请求失败: ${error.message}`,
          'NETWORK_ERROR',
          error.response?.status || 500,
          { url: error.config?.url, method: error.config?.method }
        );
      }
    );

    logger.info('HTTP客户端初始化完成', { baseURL: this.config.baseURL });
  }

  async onDestroy() {
    this.client = null;
    logger.info('HTTP客户端已销毁');
  }

  // 代理axios的所有HTTP方法
  get(url, config = {}) {
    return this.client.get(url, config);
  }

  post(url, data = null, config = {}) {
    return this.client.post(url, data, config);
  }

  put(url, data = null, config = {}) {
    return this.client.put(url, data, config);
  }

  delete(url, config = {}) {
    return this.client.delete(url, config);
  }

  patch(url, data = null, config = {}) {
    return this.client.patch(url, data, config);
  }

  head(url, config = {}) {
    return this.client.head(url, config);
  }

  options(url, config = {}) {
    return this.client.options(url, config);
  }

  request(config) {
    return this.client.request(config);
  }

  // 创建新的axios实例
  createInstance(config = {}) {
    const mergedConfig = {
      ...this.client.defaults,
      ...config,
    };
    return axios.create(mergedConfig);
  }

  // 获取axios实例以便高级使用
  getClient() {
    return this.client;
  }
}

export default AxiosInspiredHTTP;
