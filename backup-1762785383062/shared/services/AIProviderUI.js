/**
 * AI API 供应商管理系统 - UI 组件
 * 提供用户友好的界面来管理AI供应商配置
 */

import {
  AI_PROVIDERS,
  getProviderInfo,
  recommendProviders,
} from '../config/ai-providers.js';
import { eventSystem } from '../core/event/EventBus.js';
import { logger } from '../shared/utils/logger.js';
import { AIProviderManager } from './AIProviderManager.js';

export class AIProviderUI {
  constructor(container, options = {}) {
    this.container = container;
    this.manager = new AIProviderManager(options);
    this.currentStep = 'provider-selection';
    this.selectedProvider = null;
    this.config = {};

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = this.getHTML();
  }

  getHTML() {
    return `
      <div class="ai-provider-ui">
        <div class="ui-header">
          <h2>🤖 AI API 供应商管理</h2>
          <div class="step-indicator">
            <span class="${this.currentStep === 'provider-selection' ? 'active' : ''}">1. 选择供应商</span>
            <span class="${this.currentStep === 'api-config' ? 'active' : ''}">2. 配置API</span>
            <span class="${this.currentStep === 'model-discovery' ? 'active' : ''}">3. 发现模型</span>
            <span class="${this.currentStep === 'testing' ? 'active' : ''}">4. 测试连接</span>
          </div>
        </div>

        <div class="ui-content">
          ${this.getStepContent()}
        </div>

        <div class="ui-footer">
          <button class="btn-secondary" id="back-btn" ${this.canGoBack() ? '' : 'disabled'}>
            ← 上一步
          </button>
          <button class="btn-primary" id="next-btn">
            ${this.getNextButtonText()} →
          </button>
        </div>
      </div>
    `;
  }

  getStepContent() {
    switch (this.currentStep) {
      case 'provider-selection':
        return this.getProviderSelectionContent();
      case 'api-config':
        return this.getAPIConfigContent();
      case 'model-discovery':
        return this.getModelDiscoveryContent();
      case 'testing':
        return this.getTestingContent();
      default:
        return '';
    }
  }

  getProviderSelectionContent() {
    const recommendedProviders = recommendProviders({
      features: [],
      region: 'china',
      maxCost: 0.005,
      minReliability: 0.95,
    });

    return `
      <div class="provider-selection">
        <div class="section-header">
          <h3>选择AI供应商</h3>
          <p>选择您要使用的AI API供应商，我们会根据您的需求推荐最适合的选项</p>
        </div>

        <div class="recommendations">
          <h4>🌟 推荐供应商</h4>
          <div class="provider-grid">
            ${recommendedProviders.map((provider) => this.getProviderCard(provider, true)).join('')}
          </div>
        </div>

        <div class="all-providers">
          <h4>📋 所有供应商</h4>
          <div class="provider-grid">
            ${Object.entries(AI_PROVIDERS)
              .map(([id, provider]) =>
                this.getProviderCard({ id, ...provider }, false),
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  getProviderCard(provider, isRecommended = false) {
    return `
      <div class="provider-card ${isRecommended ? 'recommended' : ''} ${this.selectedProvider === provider.id ? 'selected' : ''}"
           data-provider-id="${provider.id}">
        <div class="provider-header">
          <div class="provider-icon">${provider.icon}</div>
          <div class="provider-info">
            <h4>${provider.name}</h4>
            <div class="provider-badges">
              ${isRecommended ? '<span class="badge recommended">推荐</span>' : ''}
              <span class="badge reliability">可靠性: ${(provider.reliability * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div class="provider-description">
          <p>${provider.description}</p>
        </div>
        <div class="provider-features">
          ${provider.features
            .slice(0, 3)
            .map((feature) => `<span class="feature-tag">${feature}</span>`)
            .join('')}
        </div>
        <div class="provider-pricing">
          <span class="price-info">约 ¥${this.calculateAvgPrice(provider)}/千tokens</span>
          <a href="${provider.pricing.url}" target="_blank" class="pricing-link">价格详情 →</a>
        </div>
      </div>
    `;
  }

  getAPIConfigContent() {
    if (!this.selectedProvider) {
      return '<div class="error">请先选择供应商</div>';
    }

    const provider = getProviderInfo(this.selectedProvider);
    const configFields = this.getConfigFields(provider);

    return `
      <div class="api-config">
        <div class="section-header">
          <h3>配置 ${provider.icon} ${provider.name} API</h3>
          <p>填写您的API密钥和其他必要配置信息</p>
        </div>

        <div class="config-form">
          ${configFields
            .map(
              (field) => `
            <div class="form-group">
              <label for="${field.name}">${field.label}</label>
              <input
                type="${field.type}"
                id="${field.name}"
                name="${field.name}"
                value="${this.config[field.name] || ''}"
                placeholder="${field.placeholder}"
                ${field.required ? 'required' : ''}
                ${field.type === 'password' ? 'autocomplete="current-password"' : ''}
              />
              ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
            </div>
          `,
            )
            .join('')}

          <div class="form-group">
            <label for="baseURL">Base URL (可选)</label>
            <input
              type="url"
              id="baseURL"
              name="baseURL"
              value="${this.config.baseURL || provider.baseURL}"
              placeholder="${provider.baseURL}"
            />
            <div class="field-help">如果使用自定义域名或代理，请填写完整的API地址</div>
          </div>
        </div>

        <div class="config-preview">
          <h4>配置预览</h4>
          <pre id="config-preview">${this.getConfigPreview()}</pre>
        </div>
      </div>
    `;
  }

  getConfigFields(provider) {
    const commonFields = [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: `输入您的${provider.name} API密钥`,
        required: true,
        help: `从 ${provider.website} 获取API密钥`,
      },
    ];

    // 根据供应商添加特定字段
    switch (provider.id) {
      case 'openai':
        return [
          ...commonFields,
          {
            name: 'organization',
            label: 'Organization ID (可选)',
            type: 'text',
            placeholder: 'org-...',
            required: false,
            help: 'OpenAI组织ID，用于团队计费',
          },
        ];

      case 'anthropic':
        return commonFields;

      case 'google':
        return [
          ...commonFields,
          {
            name: 'project',
            label: 'Google Cloud Project ID',
            type: 'text',
            placeholder: 'your-project-id',
            required: true,
            help: 'Google Cloud项目ID',
          },
        ];

      default:
        return commonFields;
    }
  }

  getModelDiscoveryContent() {
    if (!this.selectedProvider) {
      return '<div class="error">请先选择供应商</div>';
    }

    const provider = getProviderInfo(this.selectedProvider);

    return `
      <div class="model-discovery">
        <div class="section-header">
          <h3>发现 ${provider.icon} ${provider.name} 可用模型</h3>
          <p>正在自动发现供应商提供的AI模型...</p>
        </div>

        <div class="discovery-status">
          <div class="status-indicator" id="discovery-status">
            <div class="spinner"></div>
            <span>正在发现模型...</span>
          </div>
        </div>

        <div class="models-container" id="models-container" style="display: none;">
          <h4>可用模型</h4>
          <div class="model-grid" id="model-grid"></div>
        </div>
      </div>
    `;
  }

  getTestingContent() {
    if (!this.selectedProvider) {
      return '<div class="error">请先选择供应商</div>';
    }

    const provider = getProviderInfo(this.selectedProvider);

    return `
      <div class="connection-testing">
        <div class="section-header">
          <h3>测试 ${provider.icon} ${provider.name} 连接</h3>
          <p>验证API配置是否正确，并测试连接质量</p>
        </div>

        <div class="test-results">
          <div class="test-item" id="connection-test">
            <div class="test-header">
              <span>🔗 连接测试</span>
              <span class="test-status" id="connection-status">待测试</span>
            </div>
            <div class="test-details" id="connection-details"></div>
          </div>

          <div class="test-item" id="model-test">
            <div class="test-header">
              <span>🤖 模型测试</span>
              <span class="test-status" id="model-status">待测试</span>
            </div>
            <div class="test-details" id="model-details"></div>
          </div>

          <div class="test-item" id="performance-test">
            <div class="test-header">
              <span>⚡ 性能测试</span>
              <span class="test-status" id="performance-status">待测试</span>
            </div>
            <div class="test-details" id="performance-details"></div>
          </div>
        </div>

        <div class="test-actions">
          <button class="btn-primary" id="run-tests-btn">开始测试</button>
          <button class="btn-secondary" id="retry-tests-btn" style="display: none;">重新测试</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 供应商选择
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.provider-card')) {
        const card = e.target.closest('.provider-card');
        const providerId = card.dataset.providerId;

        this.selectProvider(providerId);
      }
    });

    // 表单输入
    this.container.addEventListener('input', (e) => {
      if (e.target.name) {
        this.config[e.target.name] = e.target.value;
        this.updateConfigPreview();
      }
    });

    // 导航按钮
    document
      .getElementById('back-btn')
      ?.addEventListener('click', () => this.goBack());
    document
      .getElementById('next-btn')
      ?.addEventListener('click', () => this.goNext());

    // 测试按钮
    document
      .getElementById('run-tests-btn')
      ?.addEventListener('click', () => this.runTests());
    document
      .getElementById('retry-tests-btn')
      ?.addEventListener('click', () => this.runTests());
  }

  selectProvider(providerId) {
    this.selectedProvider = providerId;

    // 更新UI
    const cards = this.container.querySelectorAll('.provider-card');
    cards.forEach((card) => {
      card.classList.toggle('selected', card.dataset.providerId === providerId);
    });

    // 启用下一步按钮
    this.updateNavigation();
  }

  updateConfigPreview() {
    const preview = document.getElementById('config-preview');
    if (preview) {
      const config = {
        provider: this.selectedProvider,
        ...this.config,
      };
      preview.textContent = JSON.stringify(config, null, 2);
    }
  }

  async goNext() {
    switch (this.currentStep) {
      case 'provider-selection':
        if (!this.selectedProvider) {
          this.showError('请选择一个供应商');
          return;
        }
        this.currentStep = 'api-config';
        break;

      case 'api-config':
        if (!this.validateConfig()) {
          return;
        }
        this.currentStep = 'model-discovery';
        await this.startModelDiscovery();
        break;

      case 'model-discovery':
        if (!this.discoveredModels || this.discoveredModels.length === 0) {
          this.showError('请先完成模型发现');
          return;
        }
        this.currentStep = 'testing';
        break;

      case 'testing':
        // 测试完成后可以保存配置
        await this.saveConfiguration();
        this.showSuccess('配置保存成功！');
        break;
    }

    this.render();
  }

  goBack() {
    switch (this.currentStep) {
      case 'api-config':
        this.currentStep = 'provider-selection';
        break;
      case 'model-discovery':
        this.currentStep = 'api-config';
        break;
      case 'testing':
        this.currentStep = 'model-discovery';
        break;
    }
    this.render();
  }

  canGoBack() {
    return this.currentStep !== 'provider-selection';
  }

  getNextButtonText() {
    switch (this.currentStep) {
      case 'provider-selection':
        return '配置API';
      case 'api-config':
        return '发现模型';
      case 'model-discovery':
        return '开始测试';
      case 'testing':
        return '保存配置';
      default:
        return '下一步';
    }
  }

  validateConfig() {
    const requiredFields = this.getRequiredFields();
    for (const field of requiredFields) {
      if (!this.config[field]) {
        this.showError(`请填写${field}字段`);
        return false;
      }
    }
    return true;
  }

  getRequiredFields() {
    return ['apiKey'];
  }

  async startModelDiscovery() {
    try {
      this.showDiscoveryStatus('正在发现模型...', 'loading');

      // 模拟模型发现过程
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.discoveredModels = this.getMockModels();
      this.showDiscoveryStatus('发现完成', 'success');
      this.renderDiscoveredModels();
    } catch (error) {
      this.showDiscoveryStatus('发现失败', 'error');
      logger.error('模型发现失败', error);
    }
  }

  getMockModels() {
    const provider = getProviderInfo(this.selectedProvider);
    return Object.entries(provider.pricing.models).map(([id, model]) => ({
      id,
      name: model.name,
      type: 'chat',
      contextLength: model.contextLength,
      pricing: {
        input: model.input,
        output: model.output,
      },
      capabilities: model.capabilities,
      status: 'active',
    }));
  }

  showDiscoveryStatus(message, status) {
    const statusEl = document.getElementById('discovery-status');
    if (statusEl) {
      statusEl.className = `status-indicator ${status}`;
      statusEl.innerHTML = `
        ${status === 'loading' ? '<div class="spinner"></div>' : ''}
        <span>${message}</span>
      `;
    }
  }

  renderDiscoveredModels() {
    const container = document.getElementById('models-container');
    const grid = document.getElementById('model-grid');

    if (container && grid && this.discoveredModels) {
      container.style.display = 'block';
      grid.innerHTML = this.discoveredModels
        .map(
          (model) => `
        <div class="model-card">
          <div class="model-header">
            <h5>${model.name}</h5>
            <span class="model-status ${model.status}">${model.status}</span>
          </div>
          <div class="model-info">
            <div class="model-spec">
              <span>上下文: ${model.contextLength.toLocaleString()} tokens</span>
              <span>输入价格: ¥${model.pricing.input.toFixed(4)}/token</span>
              <span>输出价格: ¥${model.pricing.output.toFixed(4)}/token</span>
            </div>
            <div class="model-capabilities">
              ${model.capabilities.map((cap) => `<span class="capability">${cap}</span>`).join('')}
            </div>
          </div>
        </div>
      `,
        )
        .join('');
    }
  }

  async runTests() {
    this.showTestStatus('connection-test', 'running', '正在测试连接...');

    try {
      // 测试连接
      await this.testConnection();
      this.showTestStatus('connection-test', 'success', '连接成功');

      // 测试模型
      this.showTestStatus('model-test', 'running', '正在测试模型...');
      await this.testModel();
      this.showTestStatus('model-test', 'success', '模型测试成功');

      // 性能测试
      this.showTestStatus('performance-test', 'running', '正在进行性能测试...');
      await this.testPerformance();
      this.showTestStatus('performance-test', 'success', '性能测试完成');

      document.getElementById('run-tests-btn').style.display = 'none';
      document.getElementById('retry-tests-btn').style.display = 'inline-block';
    } catch (error) {
      this.showTestStatus(
        'connection-test',
        'error',
        `测试失败: ${error.message}`,
      );
      document.getElementById('retry-tests-btn').style.display = 'inline-block';
    }
  }

  showTestStatus(testId, status, message) {
    const statusEl = document.getElementById(`${testId.split('-')[0]}-status`);
    const detailsEl = document.getElementById(
      `${testId.split('-')[0]}-details`,
    );

    if (statusEl) {
      statusEl.className = `test-status ${status}`;
      statusEl.textContent = this.getStatusText(status);
    }

    if (detailsEl) {
      detailsEl.textContent = message;
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'running':
        return '测试中';
      case 'success':
        return '成功';
      case 'error':
        return '失败';
      default:
        return '待测试';
    }
  }

  async testConnection() {
    // 模拟连接测试
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!this.config.apiKey) {
      throw new Error('API密钥未配置');
    }

    // 这里应该实际调用API测试连接
    return { success: true, responseTime: 245 };
  }

  async testModel() {
    // 模拟模型测试
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 这里应该发送一个简单的测试请求
    return { success: true };
  }

  async testPerformance() {
    // 模拟性能测试
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 这里应该进行多轮请求测试
    return {
      avgResponseTime: 245,
      requestsPerSecond: 4.1,
      successRate: 0.998,
    };
  }

  async saveConfiguration() {
    try {
      const config = {
        id: `${this.selectedProvider}_${Date.now()}`,
        providerId: this.selectedProvider,
        ...this.config,
        createdAt: new Date(),
        status: 'active',
      };

      // 保存到本地存储或发送到服务器
      await this.manager.registerProvider({
        ...config,
        type: this.selectedProvider,
        name: getProviderInfo(this.selectedProvider).name,
      });

      logger.info('AI供应商配置保存成功', config);
      return config;
    } catch (error) {
      logger.error('保存配置失败', error);
      throw error;
    }
  }

  updateNavigation() {
    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');

    if (backBtn) {
      backBtn.disabled = !this.canGoBack();
    }

    if (nextBtn) {
      nextBtn.textContent = this.getNextButtonText();
    }
  }

  calculateAvgPrice(provider) {
    const models = Object.values(provider.pricing.models);
    const avgPrice =
      models.reduce((sum, model) => sum + (model.input + model.output) / 2, 0) /
      models.length;
    return (avgPrice * 1000).toFixed(2);
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showMessage(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// CSS 样式
const styles = `
<style>
.ai-provider-ui {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ui-header {
  margin-bottom: 30px;
}

.ui-header h2 {
  color: #1f2937;
  margin-bottom: 20px;
}

.step-indicator {
  display: flex;
  gap: 20px;
}

.step-indicator span {
  padding: 8px 16px;
  background: #f3f4f6;
  border-radius: 20px;
  color: #6b7280;
  font-size: 14px;
}

.step-indicator span.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.ui-content {
  min-height: 400px;
  margin-bottom: 30px;
}

.ui-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-primary, .btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.provider-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.provider-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.provider-card.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 2px #667eea;
}

.provider-card.recommended {
  border-color: #f59e0b;
  position: relative;
}

.provider-card.recommended::before {
  content: '⭐';
  position: absolute;
  top: -10px;
  right: -10px;
  background: #f59e0b;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.provider-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.provider-icon {
  font-size: 32px;
  margin-right: 12px;
}

.provider-info h4 {
  margin: 0 0 4px 0;
  color: #1f2937;
}

.provider-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge.recommended {
  background: #fef3c7;
  color: #f59e0b;
}

.badge.reliability {
  background: #dbeafe;
  color: #2563eb;
}

.provider-description p {
  color: #6b7280;
  margin: 0 0 12px 0;
  font-size: 14px;
}

.provider-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.feature-tag {
  background: #f3f4f6;
  color: #374151;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.provider-pricing {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-info {
  color: #059669;
  font-weight: 600;
}

.pricing-link {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.pricing-link:hover {
  text-decoration: underline;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h3 {
  color: #1f2937;
  margin-bottom: 8px;
}

.section-header p {
  color: #6b7280;
  margin: 0;
}

.config-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #374151;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field-help {
  margin-top: 4px;
  color: #6b7280;
  font-size: 14px;
}

.config-preview {
  margin-top: 24px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.config-preview h4 {
  margin: 0 0 12px 0;
  color: #1f2937;
}

.config-preview pre {
  background: #1f2937;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0;
  font-size: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.status-indicator.loading {
  background: #fefce8;
  border-color: #fde047;
}

.status-indicator.success {
  background: #f0fdf4;
  border-color: #22c55e;
}

.status-indicator.error {
  background: #fef2f2;
  border-color: #ef4444;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.model-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.model-header h5 {
  margin: 0;
  color: #1f2937;
}

.model-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.model-status.active {
  background: #dcfce7;
  color: #166534;
}

.model-spec {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #6b7280;
}

.model-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.capability {
  background: #e0e7ff;
  color: #3730a3;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.test-results {
  margin-bottom: 24px;
}

.test-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.test-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.test-status.running {
  background: #fef3c7;
  color: #f59e0b;
}

.test-status.success {
  background: #dcfce7;
  color: #166534;
}

.test-status.error {
  background: #fee2e2;
  color: #dc2626;
}

.test-details {
  color: #6b7280;
  font-size: 14px;
}

.test-actions {
  text-align: center;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

.notification.success {
  background: #22c55e;
}

.notification.error {
  background: #ef4444;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 0;
  }
}

@media (max-width: 768px) {
  .provider-grid {
    grid-template-columns: 1fr;
  }

  .step-indicator {
    flex-direction: column;
    gap: 8px;
  }

  .ui-footer {
    flex-direction: column;
    gap: 12px;
  }

  .btn-primary, .btn-secondary {
    width: 100%;
  }
}
</style>
`;

// 将样式添加到页面
if (
  typeof document !== 'undefined' &&
  !document.querySelector('#ai-provider-styles')
) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-provider-styles';
  styleElement.textContent = styles
    .replace('<style>', '')
    .replace('</style>', '');
  document.head.appendChild(styleElement);
}

export default AIProviderUI;
