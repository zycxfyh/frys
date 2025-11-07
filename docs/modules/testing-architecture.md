# WokeFlow 测试架构文档

## 📚 初学者指南 - 零基础也能看懂

<div style="background-color: #fff9c4; padding: 20px; border-left: 5px solid #fbc02d; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57f17;">🎓 什么是"测试"？</h3>
  <p>想象一下，你要买一辆新车。测试就像是<strong>汽车质量检测</strong>：</p>
  <ul>
    <li>🔍 <strong>功能测试</strong> - 就像"试驾"，检查汽车的各项功能是否正常（刹车、转向、加速等）</li>
    <li>⚡ <strong>性能测试</strong> - 就像"性能测试"，检查汽车的速度、油耗、稳定性等</li>
    <li>🛡️ <strong>安全测试</strong> - 就像"碰撞测试"，检查汽车的安全性能</li>
  </ul>
  <p>在 WokeFlow 中，测试就是<strong>自动检查程序是否正常工作</strong>，确保程序能够正确完成各种功能，不会出现错误。</p>
</div>

### 🏠 用生活比喻理解测试

#### 1. 🧪 单元测试 - 就像"零件检测"

<div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #0277bd;">🏭 生活场景：工厂零件质检</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🔧 单个零件：工厂生产螺丝、齿轮等单个零件</li>
    <li>✅ 零件检测：每个零件都要单独检测，确保尺寸、质量符合标准</li>
    <li>⚡ 快速检测：零件检测很快，几秒钟就能完成</li>
    <li>📊 批量检测：可以同时检测很多零件，效率很高</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 单元测试：就像"零件检测"，测试程序的每个小功能是否正常</li>
    <li>🔍 独立测试：每个功能单独测试，不依赖其他功能</li>
    <li>⚡ 快速执行：测试执行很快，几毫秒就能完成</li>
    <li>📊 批量测试：可以同时运行很多测试，快速发现问题</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>单元测试就像检查每个零件是否合格，确保每个小功能都正常工作，这是最基础的测试。
  </div>
</div>

#### 2. 🔗 集成测试 - 就像"组装测试"

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">🏭 生活场景：组装产品测试</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🔧 组装产品：把多个零件组装成完整产品（比如把螺丝、齿轮组装成机器）</li>
    <li>✅ 组装测试：测试组装后的产品，各个零件是否能正常配合工作</li>
    <li>🔗 连接测试：测试零件之间的连接是否牢固、配合是否顺畅</li>
    <li>⏱️ 稍慢测试：组装测试比零件检测慢一些，但能发现组装问题</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 集成测试：就像"组装测试"，测试多个模块是否能正常协作</li>
    <li>🔗 协作测试：测试模块之间的连接和配合是否正常</li>
    <li>📋 流程测试：测试完整的业务流程是否正常</li>
    <li>⏱️ 稍慢执行：比单元测试慢一些，但能发现模块间的问题</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>集成测试就像检查组装后的产品，确保各个部分能够正常配合工作，不会出现连接问题。
  </div>
</div>

#### 3. 🚀 端到端测试 - 就像"完整产品测试"

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #2e7d32;">🏭 生活场景：完整产品验收</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🚗 完整产品：一辆完整的汽车，所有零件都已组装好</li>
    <li>✅ 完整测试：像真实用户一样使用产品，测试完整的使用流程</li>
    <li>🔄 流程测试：测试从启动到完成整个使用流程（启动 → 行驶 → 停车）</li>
    <li>⏰ 较慢测试：完整测试需要较长时间，但能发现整体问题</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 端到端测试：就像"完整产品测试"，像真实用户一样测试整个系统</li>
    <li>🔄 流程测试：测试从用户操作到系统响应的完整流程</li>
    <li>👤 用户视角：从用户的角度测试，确保用户体验正常</li>
    <li>⏰ 较慢执行：执行时间较长，但能发现整体流程问题</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>端到端测试就像真实用户使用产品，测试完整的业务流程，确保用户能够正常使用系统。
  </div>
</div>

#### 4. ⚡ 性能测试 - 就像"性能测试"

<div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #f57c00;">🏎️ 生活场景：汽车性能测试</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🏎️ 速度测试：测试汽车的最高速度、加速性能</li>
    <li>⛽ 油耗测试：测试汽车的燃油效率</li>
    <li>💪 负载测试：测试汽车在满载情况下的性能</li>
    <li>📊 数据记录：记录所有性能数据，便于分析和改进</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 性能测试：就像"性能测试"，测试程序的运行速度和资源使用</li>
    <li>⚡ 速度测试：测试程序响应时间、处理速度</li>
    <li>💾 资源测试：测试程序的内存使用、CPU占用</li>
    <li>📊 性能数据：记录性能指标，便于优化和改进</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>性能测试就像测试汽车的性能，确保程序运行速度快、资源使用少，不会因为性能问题影响用户体验。
  </div>
</div>

#### 5. 🛡️ 安全测试 - 就像"安全检测"

<div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #c62828;">🔒 生活场景：银行安全检测</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🔐 密码测试：测试银行系统是否能防止密码破解</li>
    <li>🚪 权限测试：测试是否只有授权人员才能访问敏感信息</li>
    <li>🛡️ 防护测试：测试系统是否能抵御各种攻击（黑客攻击、病毒等）</li>
    <li>🔍 漏洞扫描：主动寻找系统可能存在的安全漏洞</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 安全测试：就像"安全检测"，测试程序是否能抵御各种安全威胁</li>
    <li>🔐 认证测试：测试用户认证是否安全，防止未授权访问</li>
    <li>🛡️ 攻击测试：模拟各种攻击，测试系统的防护能力</li>
    <li>🔍 漏洞扫描：主动寻找可能存在的安全漏洞</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>安全测试就像银行的安全检测，确保程序能够抵御各种安全威胁，保护用户数据和系统安全。
  </div>
</div>

### 📊 测试金字塔 - 理解测试层次

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🏗️ 测试金字塔模型</h3>
  
  <p><strong>就像建房子一样：</strong></p>
  
  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
    <p><strong>🏗️ 底层（单元测试）- 最多</strong></p>
    <p style="margin-left: 20px;">就像房子的地基和砖块，数量最多，但每个都很小。单元测试测试每个小功能，数量最多，但执行最快。</p>
    
    <p style="margin-top: 15px;"><strong>🏢 中层（集成测试）- 中等</strong></p>
    <p style="margin-left: 20px;">就像房子的房间，由多个砖块组成。集成测试测试多个模块的协作，数量中等，执行时间中等。</p>
    
    <p style="margin-top: 15px;"><strong>🏛️ 顶层（端到端测试）- 最少</strong></p>
    <p style="margin-left: 20px;">就像整栋房子，包含所有房间。端到端测试测试整个系统，数量最少，但执行时间最长。</p>
  </div>

  <div style="text-align: center; margin: 20px 0;">
    <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; display: inline-block; font-size: 0.9em;">
    ┌─────────────────┐
    │  端到端测试      │  ← 少量，完整流程
    │  (E2E Tests)    │
    ├─────────────────┤
    │  集成测试        │  ← 中等，模块协作
    │  (Integration)  │
    ├─────────────────┤
    │  单元测试        │  ← 大量，独立功能
    │  (Unit Tests)   │
    └─────────────────┘
    </pre>
  </div>
</div>

### ❓ 常见问题解答

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤔 你可能想问的问题</h3>

  <h4 style="color: #388e3c;">Q1: 为什么要测试？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像生产产品需要质检一样，写程序也需要测试。测试可以确保程序正常工作，不会出现错误，保护用户数据安全。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q2: 测试是人工做的吗？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 大部分是自动的！就像工厂的自动化质检设备一样，测试可以自动运行，快速发现问题，比人工测试更高效、更准确。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q3: 什么是"测试覆盖率"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像检查是否所有零件都检测过一样，测试覆盖率表示程序的代码有多少被测试过。覆盖率越高，说明测试越全面，程序越可靠。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q4: 测试会影响程序运行吗？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 不会！测试只在开发阶段运行，不会影响用户使用的程序。就像汽车出厂前的检测，不会影响用户开车一样。</p>
</div>

## 📖 概述

<div style="background-color: #e8f5e8; padding: 20px; border-left: 5px solid #4caf50; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🧪 全方位质量保障体系</h3>
  <p>WokeFlow 采用<strong>多层次的测试策略</strong>，确保系统在<strong>功能</strong>、<strong>性能</strong>、<strong>安全性</strong>方面的可靠性。测试架构基于 <strong>Vitest 测试框架</strong>，结合 <strong>Istanbul 覆盖率工具</strong>，提供全面的自动化测试解决方案。</p>
  <p><strong>简单说：</strong>测试就像程序的"质量检测系统"，自动检查程序是否正常工作，确保程序可靠、安全、高效。</p>
  <p><strong>核心理念</strong>：测试不仅是质量保障工具，更是系统设计的镜子。</p>
</div>

## 🎯 测试架构设计原则

### 1. 🏢 分层测试策略

<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #f57c00;">测试金字塔模型</h4>
  <div style="text-align: center; margin: 20px 0;">
    <pre style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; display: inline-block;">
    E2E Tests (端到端)
       ▲     少量、关键路径
       │
    Integration (集成)
       ▲     中等数量、模块协作
       │
    Unit Tests (单元)
       ▲     大量、独立功能
     ━━━━━  底层基础设施 ━━━━━
    </pre>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
    <thead>
      <tr style="background-color: #ffe0b2;">
        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">测试类型</th>
        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">范围</th>
        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">执行速度</th>
        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">失败影响</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>单元测试</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">单个模块独立功能</td>
        <td style="padding: 10px; border: 1px solid #ddd;">⚡ ~10ms</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🔴 核心逻辑错误</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>集成测试</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">模块间协作能力</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🟡 ~100ms</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🟠 接口契约问题</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>端到端测试</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">完整业务流程</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🐌 ~10s</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🟡 用户体验问题</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>性能测试</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">系统性能指标</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🐌 ~30s</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🟠 性能退化</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>安全测试</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">攻击模拟验证</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🐌 ~60s</td>
        <td style="padding: 10px; border: 1px solid #ddd;">🔴 安全漏洞</td>
      </tr>
    </tbody>
  </table>
</div>

### 2. 🚀 测试驱动开发 (TDD)

<div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #1976d2;">红绿重构循环</h4>
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="background-color: #ffcdd2; color: #c62828; padding: 5px 10px; border-radius: 15px; font-weight: bold;">🔴 写测试</span>
      <span style="color: #666;">→ 先写失败的测试</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="background-color: #c8e6c9; color: #2e7d32; padding: 5px 10px; border-radius: 15px; font-weight: bold;">🟢 让测试通过</span>
      <span style="color: #666;">→ 编写最简代码</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="background-color: #bbdefb; color: #1976d2; padding: 5px 10px; border-radius: 15px; font-weight: bold;">🔵 重构代码</span>
      <span style="color: #666;">→ 改进设计，保持测试通过</span>
    </div>
  </div>

  <h4 style="margin-top: 20px; color: #1976d2;">TDD 价值</h4>
  <ul>
    <li><strong>📚 测试即文档</strong>：通过测试用例展示API使用方法</li>
    <li><strong>🔒 防止回归</strong>：任何修改都能及时发现问题</li>
    <li><strong>🎯 设计导向</strong>：测试先行的思维方式改善代码设计</li>
    <li><strong>⚡ 持续集成</strong>：每次提交自动运行测试，快速反馈</li>
  </ul>
</div>

### 3. 📊 覆盖率驱动质量

<div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">覆盖率目标分层</h4>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
    <div style="background-color: #e1bee7; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; color: #4a148c; margin-bottom: 10px;">🎯</div>
      <strong>核心模块</strong><br/>
      <span style="font-size: 1.5em; color: #4a148c;">90%+</span><br/>
      <small>语句/分支/函数覆盖率</small>
    </div>
    <div style="background-color: #e1bee7; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; color: #4a148c; margin-bottom: 10px;">📈</div>
      <strong>业务逻辑</strong><br/>
      <span style="font-size: 1.5em; color: #4a148c;">85%+</span><br/>
      <small>主要业务流程覆盖</small>
    </div>
    <div style="background-color: #e1bee7; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; color: #4a148c; margin-bottom: 10px;">🛡️</div>
      <strong>错误处理</strong><br/>
      <span style="font-size: 1.5em; color: #4a148c;">95%+</span><br/>
      <small>异常情况覆盖</small>
    </div>
    <div style="background-color: #e1bee7; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 2em; color: #4a148c; margin-bottom: 10px;">🔄</div>
      <strong>持续监控</strong><br/>
      <span style="font-size: 1.5em; color: #4a148c;">100%</span><br/>
      <small>每日覆盖率检查</small>
    </div>
  </div>

  <h4 style="margin-top: 20px; color: #7b1fa2;">质量门禁机制</h4>
  <div style="background-color: #f8f8f8; padding: 15px; border-radius: 8px;">
    <ul>
      <li><strong>🚫 覆盖率下降</strong>：新代码覆盖率低于阈值禁止合并</li>
      <li><strong>❌ 测试失败</strong>：任何测试用例失败禁止合并</li>
      <li><strong>🔍 代码质量</strong>：ESLint/Prettier 检查失败禁止合并</li>
      <li><strong>📋 安全扫描</strong>：发现高危安全问题禁止合并</li>
    </ul>
  </div>
</div>

## 测试层次详解

### 1. 单元测试 (Unit Tests)

#### 测试范围
单元测试专注于测试单个模块的独立功能，不依赖外部系统或服务。

#### 测试结构
```
tests/unit/
├── core/                    # 核心模块单元测试
│   ├── axios-inspired-http.test.js
│   ├── zustand-inspired-state.test.js
│   ├── jwt-inspired-auth.test.js
│   └── ...
└── utils/                   # 工具模块单元测试
```

#### 单元测试示例

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ZustandInspiredState from '../../../src/core/ZustandInspiredState.js';

describe('ZustandInspiredState', () => {
  let zustand;

  beforeEach(async () => {
    zustand = new ZustandInspiredState();
    await zustand.initialize();
  });

  afterEach(async () => {
    if (zustand) {
      await zustand.destroy();
    }
    zustand = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(zustand).toBeInstanceOf(ZustandInspiredState);
      expect(zustand.stores).toBeDefined();
    });
  });

  describe('状态存储创建', () => {
    it('应该能创建简单的计数器存储', () => {
      const counterStore = zustand.create((set, get) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 })),
        decrement: () => set(state => ({ count: state.count - 1 })),
        getCount: () => get().count
      }));

      expect(counterStore).toBeDefined();
      expect(typeof counterStore.increment).toBe('function');
    });

    it('应该能正确更新状态', () => {
      const counterStore = zustand.create((set) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 }))
      }));

      counterStore.increment();
      expect(counterStore.getState().count).toBe(1);

      counterStore.increment();
      expect(counterStore.getState().count).toBe(2);
    });
  });
});
```

#### 测试覆盖率目标
- **语句覆盖率**: > 80%
- **分支覆盖率**: > 80%
- **函数覆盖率**: > 80%
- **行覆盖率**: > 80%
- **核心模块**: > 90%

### 2. 集成测试 (Integration Tests)

#### 测试范围
集成测试验证模块间的协作能力，包括依赖注入、事件通信、数据流转等。

#### 测试结构
```
tests/integration/
├── end-to-end-workflow.test.js    # 端到端工作流测试
├── http-auth-integration.test.js  # HTTP与认证集成测试
├── messaging-state-integration.test.js  # 消息与状态集成测试
├── security-integration.test.js   # 安全集成测试
└── system-integration.test.js     # 系统集成测试
```

#### 集成测试示例

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const LightweightContainer = (await import('../../../src/core/LightweightContainer.js')).LightweightContainer;
const AxiosInspiredHTTP = (await import('../../../src/core/AxiosInspiredHTTP.js')).default;
const JWTInspiredAuth = (await import('../../../src/core/JWTInspiredAuth.js')).default;

describe('系统集成测试', () => {
  let container;
  let httpClient;
  let auth;

  beforeAll(async () => {
    // 初始化依赖注入容器
    container = new LightweightContainer();

    // 注册核心服务
    container.register('http', AxiosInspiredHTTP);
    container.register('auth', JWTInspiredAuth);

    // 初始化核心模块
    httpClient = container.resolve('http');
    auth = container.resolve('auth');

    await httpClient.initialize();
    await auth.initialize();

    // 设置认证密钥
    auth.setSecret('default', 'test-secret-key-for-integration');
  });

  afterAll(async () => {
    // 清理资源
    if (auth) await auth.destroy();
    if (httpClient) await httpClient.destroy();
  });

  describe('HTTP与认证集成', () => {
    it('应该能创建认证令牌并在HTTP请求中使用', async () => {
      // 创建JWT令牌
      const token = auth.generateToken({
        userId: 'test-user',
        username: 'testuser'
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证令牌
      const decoded = auth.verifyToken(token);
      expect(decoded.userId).toBe('test-user');
      expect(decoded.username).toBe('testuser');
    });

    it('应该能处理HTTP请求的认证拦截', async () => {
      // 创建带认证的HTTP实例
      const authedHttp = await httpClient.createInstance({
        baseURL: 'https://httpbin.org',
        interceptors: {
          request: [(config) => {
            const token = auth.generateToken({ userId: 'test' });
            config.headers.Authorization = `Bearer ${token}`;
            return config;
          }]
        }
      });

      // 执行请求（这里会失败，因为httpbin.org返回401，但我们测试拦截器）
      try {
        await authedHttp.get('/bearer');
      } catch (error) {
        // 验证请求头包含了认证令牌
        expect(error.config.headers.Authorization).toBeDefined();
        expect(error.config.headers.Authorization.startsWith('Bearer ')).toBe(true);
      }
    });
  });
});
```

#### 集成测试场景
- **依赖注入**: 验证服务间的依赖关系
- **事件通信**: 测试发布订阅模式的正确性
- **数据流转**: 验证数据在模块间的传递
- **错误处理**: 测试异常情况下的系统行为
- **生命周期**: 验证模块的初始化和销毁

### 3. 端到端测试 (E2E Tests)

#### 测试范围
端到端测试验证完整业务流程，从用户操作到系统响应的全链路测试。

#### 测试示例

```javascript
describe('端到端工作流测试', () => {
  it('应该完成完整的工作流创建和执行流程', async () => {
    // 1. 用户注册
    const userData = {
      username: 'workflowuser',
      email: 'workflow@test.com',
      password: 'password123'
    };

    const registerResponse = await apiClient.post('/auth/register', userData);
    expect(registerResponse.status).toBe(201);

    // 2. 用户登录
    const loginResponse = await apiClient.post('/auth/login', {
      username: userData.username,
      password: userData.password
    });
    expect(loginResponse.status).toBe(200);

    const token = loginResponse.data.token;

    // 3. 创建工作流
    const workflowData = {
      name: '测试工作流',
      description: '端到端测试工作流',
      tasks: [
        {
          id: 'task1',
          name: '验证用户',
          type: 'script',
          script: 'return context.userData.email.includes("@");'
        }
      ]
    };

    const workflowResponse = await apiClient.post('/workflows', workflowData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(workflowResponse.status).toBe(201);

    const workflowId = workflowResponse.data.id;

    // 4. 启动工作流
    const startResponse = await apiClient.post(`/workflows/${workflowId}/start`, {
      userData: { email: 'test@example.com' }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(startResponse.status).toBe(200);

    // 5. 等待工作流完成
    await waitForWorkflowCompletion(workflowId, token);

    // 6. 验证工作流结果
    const resultResponse = await apiClient.get(`/workflows/${workflowId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(resultResponse.data.status).toBe('completed');
  });
});
```

### 4. 性能测试 (Performance Tests)

#### 测试范围
性能测试验证系统在高负载下的表现，包括响应时间、内存使用、并发处理能力等。

#### 性能测试示例

```javascript
describe('核心模块性能测试', () => {
  describe('消息队列性能测试', () => {
    it('应该处理高频消息发布', async () => {
      const connection = await messaging.connect('perf-cluster');

      const topic = 'perf.messages';
      const messageCount = 1000;
      const messages = [];

      // 创建订阅者
      const subscription = messaging.subscribe(topic, (message) => {
        messages.push(JSON.parse(message));
      });

      // 记录开始时间
      const startTime = performance.now();

      // 发布大量消息
      const publishPromises = [];
      for (let i = 0; i < messageCount; i++) {
        publishPromises.push(
          messaging.publish(topic, JSON.stringify({ id: i, data: `message-${i}` }))
        );
      }

      await Promise.all(publishPromises);

      // 等待所有消息被处理
      await new Promise(resolve => {
        const checkMessages = () => {
          if (messages.length === messageCount) {
            resolve();
          } else {
            setTimeout(checkMessages, 10);
          }
        };
        checkMessages();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 验证性能指标
      expect(totalTime).toBeLessThan(5000); // 5秒内完成
      expect(messages.length).toBe(messageCount);

      // 计算每秒消息数
      const messagesPerSecond = messageCount / (totalTime / 1000);
      console.log(`消息吞吐量: ${messagesPerSecond.toFixed(2)} msg/s`);

      messaging.unsubscribe(topic, subscription.id);
    });
  });
});
```

#### 性能指标
- **响应时间**: API响应时间 < 100ms
- **吞吐量**: 每秒处理请求数 > 1000
- **内存使用**: 堆内存使用 < 50MB
- **CPU使用率**: CPU使用率 < 70%
- **并发处理**: 支持 100+ 并发连接

### 5. 安全测试 (Security Tests / Red Team)

#### 测试范围
安全测试采用红队思维，模拟各种攻击向量，验证系统的安全防护能力。

#### 安全测试框架

```javascript
class RedTeamFramework {
  constructor() {
    this.attacks = new Map();
    this.results = [];
  }

  registerAttack(type, attackFunction) {
    this.attacks.set(type, attackFunction);
  }

  async executeAttack(type, payload) {
    const attack = this.attacks.get(type);
    if (!attack) {
      throw new Error(`未知攻击类型: ${type}`);
    }

    const result = await attack(payload);
    this.results.push({
      type,
      payload,
      result,
      timestamp: new Date()
    });

    return result;
  }
}

// 攻击向量定义
export const AttackVectors = {
  AUTH_BYPASS: 'auth_bypass',
  SQL_INJECTION: 'sql_injection',
  XSS: 'xss',
  CSRF: 'csrf',
  FUZZING: 'fuzzing',
  PRIVILEGE_ESCALATION: 'privilege_escalation'
};
```

#### 认证绕过测试示例

```javascript
describe('认证绕过攻击测试', () => {
  let redTeam;
  let auth;

  beforeEach(() => {
    redTeam = new RedTeamFramework();
    auth = new JWTInspiredAuth();
    auth.setSecret('test-key', 'my-test-secret');
  });

  it('应该阻止SQL注入式认证绕过', async () => {
    const bypassPayloads = [
      { username: "admin' --", password: 'anything' },
      { username: 'admin', password: "pass' OR '1'='1" },
      { username: "admin'; DROP TABLE users; --", password: '' }
    ];

    for (const payload of bypassPayloads) {
      const result = await redTeam.executeAttack(AttackVectors.AUTH_BYPASS, {
        credentials: payload,
        bypassMethod: 'sql_injection'
      });

      // 期望攻击被阻止
      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    }
  });

  it('应该阻止令牌伪造攻击', async () => {
    const fakeTokens = [
      'invalid.jwt.token',
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.fake.signature',
      '',
      null,
      'tampered.header.payload.signature'
    ];

    for (const token of fakeTokens) {
      const result = await redTeam.executeAttack(AttackVectors.AUTH_BYPASS, {
        token,
        bypassMethod: 'token_forgery'
      });

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(false);
    }
  });
});
```

#### 安全测试向量
- **认证绕过**: SQL注入、令牌伪造、暴力破解
- **注入攻击**: SQL注入、命令注入、XSS攻击
- **访问控制**: 权限提升、越权访问、CSRF攻击
- **模糊测试**: 随机输入测试边界情况
- **加密安全**: 密钥泄露、算法弱点

## 测试基础设施

### 1. 测试配置 (vitest.config.js)

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        'docs/',
        'dist/',
        'demo-*.js',
        '*.config.js'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        './src/core/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    testTimeout: 10000,
    maxConcurrency: 5,
    reporters: ['verbose'],
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', 'coverage']
  }
});
```

### 2. 测试环境设置 (setup.js)

```javascript
// 全局测试辅助函数
global.performanceMonitor = {
  start: () => performance.now(),
  end: (startTime) => ({
    duration: performance.now() - startTime,
    formatted: `${(performance.now() - startTime).toFixed(2)}ms`
  })
};

global.testDataGenerator = {
  uuid: () => `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  user: () => ({
    id: global.testDataGenerator.uuid(),
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@test.com`
  })
};

global.asyncHelpers = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) return true;
      await global.asyncHelpers.sleep(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};
```

### 3. 测试配置 (test-config.js)

```javascript
export const TEST_CONFIG = {
  environment: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error'
  },
  api: {
    baseURL: 'https://api.workflow.test',
    timeout: 5000
  },
  auth: {
    secret: 'test-jwt-secret-key-for-wokeflow-testing'
  }
};

export class TestDataGenerator {
  static generateUser(overrides = {}) {
    return {
      id: this.generateId(),
      username: `user_${this.generateId()}`,
      email: `user${this.generateId()}@test.com`,
      role: 'user',
      createdAt: new Date(),
      ...overrides
    };
  }
}
```

## 测试运行和报告

### 1. 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行性能测试
npm run test:performance

# 运行安全测试
npm run test:security

# 运行覆盖率测试
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

### 2. 覆盖率报告

```bash
# 生成详细覆盖率报告
npm run test:coverage

# 查看HTML覆盖率报告
open coverage/index.html

# LCOV格式报告（CI/CD使用）
cat coverage/lcov.info
```

### 3. 性能基准测试

```bash
# 运行性能基准测试
npm run benchmark

# 比较性能变化
node scripts/benchmark.js compare
```

## CI/CD 集成

### GitHub Actions 配置

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run security tests
        run: npm run test:security

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

      - name: Run performance tests
        run: npm run test:performance
```

## 测试最佳实践

### 1. 测试组织
- **描述性命名**: 测试名称应该清晰描述测试内容
- **独立性**: 每个测试应该独立运行，不依赖其他测试
- **快速执行**: 单元测试应该在毫秒级完成
- **可重复性**: 测试结果应该是一致的

### 2. 测试数据管理
- **测试数据生成**: 使用工厂函数生成测试数据
- **数据隔离**: 每个测试使用独立的数据
- **清理机制**: 测试后自动清理数据
- **边界情况**: 包含边界值和异常情况

### 3. 模拟和存根
- **外部依赖**: 使用模拟对象替代外部服务
- **确定性**: 模拟对象提供确定性的响应
- **验证调用**: 验证被测代码正确调用了依赖

### 4. 异步测试
- **Promise处理**: 正确处理异步操作
- **超时控制**: 设置合理的测试超时时间
- **竞态条件**: 避免异步操作的竞态条件

### 5. 性能测试
- **基准测试**: 建立性能基准线
- **趋势监控**: 监控性能变化趋势
- **瓶颈识别**: 识别性能瓶颈位置
- **资源监控**: 监控内存和CPU使用

## 总结

WokeFlow 的测试架构提供了从单元测试到安全测试的完整测试体系，确保系统的功能正确性、性能表现和安全可靠性。通过分层的测试策略和自动化的CI/CD集成，实现了高质量的软件交付标准。
