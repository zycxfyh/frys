# WokeFlow 核心功能模块文档

## 📚 初学者指南 - 零基础也能看懂

<div style="background-color: #fff9c4; padding: 20px; border-left: 5px solid #fbc02d; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57f17;">🎓 什么是"核心功能模块"？</h3>
  <p>想象一下，你要建造一座房子。核心功能模块就像是房子的<strong>基础设施</strong>：水管系统、电路系统、网络系统等。这些是房子正常运转所必需的基础功能。</p>
  <p>在 WokeFlow 中，核心功能模块提供了程序运行所需的基础能力，比如<strong>发送网络请求</strong>、<strong>管理数据状态</strong>、<strong>处理消息</strong>等。</p>
</div>

### 🏠 用生活比喻理解各个模块

#### 1. 🌐 HTTP 客户端 - 就像"邮递员"

<div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #0277bd;">📮 生活场景：寄送包裹</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📦 你要给朋友寄包裹：需要填写地址、选择快递公司、打包物品</li>
    <li>🚚 邮递员的工作：接收包裹、送到目的地、带回回执</li>
    <li>📋 自动处理：邮递员会自动处理地址格式、选择最佳路线、记录物流信息</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 HTTP 客户端：就像"邮递员"，负责在程序之间传递信息</li>
    <li>📤 发送请求：程序A想获取数据，通过HTTP客户端发送请求</li>
    <li>📥 接收响应：程序B收到请求后，通过HTTP客户端返回数据</li>
    <li>🔄 自动处理：HTTP客户端自动处理数据格式转换、错误重试等</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>HTTP 客户端就像是一个专业的"邮递员系统"，帮你发送和接收网络请求，自动处理各种细节，你只需要告诉它"发送什么"和"发送到哪里"。
  </div>
</div>

#### 2. 💾 状态管理 - 就像"记事本"

<div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">📝 生活场景：记录重要信息</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📋 记事本：用来记录重要信息（购物清单、待办事项、联系方式等）</li>
    <li>✏️ 随时更新：可以随时添加、修改、删除记录</li>
    <li>👀 自动通知：当你更新记录时，所有需要知道的人都会收到通知</li>
    <li>🔍 快速查找：可以快速找到需要的信息</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 状态管理：就像"智能记事本"，用来存储程序运行时的数据</li>
    <li>📊 数据存储：存储用户信息、系统配置、业务数据等</li>
    <li>🔄 自动更新：当数据改变时，所有使用这些数据的组件都会自动更新</li>
    <li>🔍 快速访问：可以快速读取和修改数据</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>状态管理就像一个"智能记事本"，不仅记录数据，还能在数据变化时自动通知所有相关的地方，让整个程序保持数据一致。
  </div>
</div>

#### 3. 📢 消息传递 - 就像"广播系统"

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #2e7d32;">📻 生活场景：学校广播</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📢 学校广播：广播员发布消息（"请各班班长到会议室开会"）</li>
    <li>👂 学生收听：所有学生都能听到广播，但只有相关的人会响应</li>
    <li>📋 主题分类：不同主题的消息（通知、音乐、新闻）分开广播</li>
    <li>🔄 实时传递：消息发布后立即传递到所有收听者</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 消息传递：就像"广播系统"，让程序的不同部分可以互相通信</li>
    <li>📤 发布消息：一个模块发布消息（比如"用户已登录"）</li>
    <li>📥 订阅消息：其他模块订阅感兴趣的消息（比如"邮件模块"订阅"用户已登录"）</li>
    <li>🔄 自动通知：消息发布后，所有订阅者都会收到通知</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>消息传递就像一个"广播系统"，让程序的不同部分可以互相"说话"和"听"，实现模块之间的解耦通信。
  </div>
</div>

#### 4. 🔐 认证授权 - 就像"门禁系统"

<div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #f57c00;">🚪 生活场景：公司门禁</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🆔 员工卡：每个员工有一张门禁卡，证明身份</li>
    <li>🔓 刷卡开门：刷卡后，系统验证身份，决定是否开门</li>
    <li>🚪 权限控制：普通员工只能进普通区域，管理员可以进所有区域</li>
    <li>⏰ 时效性：门禁卡有有效期，过期需要重新办理</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 认证授权：就像"门禁系统"，验证用户身份和控制访问权限</li>
    <li>🎫 生成令牌：用户登录后，系统生成一个"令牌"（类似门禁卡）</li>
    <li>✅ 验证身份：每次访问资源时，系统验证令牌是否有效</li>
    <li>🔒 权限检查：根据用户角色，决定是否可以访问特定资源</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>认证授权就像一个"智能门禁系统"，不仅验证你是谁，还控制你能访问哪些资源，确保系统安全。
  </div>
</div>

#### 5. 📅 日期时间处理 - 就像"万年历"

<div style="background-color: #fce4ec; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #c2185b;">📆 生活场景：日历和时钟</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>📅 日历：可以查看日期、计算日期差、判断星期几</li>
    <li>⏰ 时钟：显示当前时间、计算时间差、设置提醒</li>
    <li>🌍 时区：不同地区有不同的时区，需要转换</li>
    <li>📊 格式化：可以用不同格式显示日期（2024-01-01 或 2024年1月1日）</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 日期时间处理：就像"智能万年历"，提供各种日期时间操作</li>
    <li>📅 日期计算：计算两个日期之间的天数、判断是否工作日</li>
    <li>⏰ 时间格式化：将时间转换成不同格式显示</li>
    <li>🌍 时区转换：在不同时区之间转换时间</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>日期时间处理就像一个"智能万年历"，帮你处理所有与日期时间相关的操作，让复杂的日期计算变得简单。
  </div>
</div>

#### 6. 🛠️ 工具函数库 - 就像"瑞士军刀"

<div style="background-color: #e0f2f1; padding: 20px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #00695c;">🔧 生活场景：多功能工具箱</h4>
  
  <p><strong>想象一下：</strong></p>
  <ul>
    <li>🛠️ 工具箱：包含各种常用工具（螺丝刀、扳手、锤子等）</li>
    <li>⚡ 快速使用：需要什么工具，直接拿出来用，不用自己制作</li>
    <li>🔄 通用工具：这些工具可以用于各种场景</li>
    <li>📦 分类整理：工具按功能分类，方便查找</li>
  </ul>

  <p><strong>在代码中：</strong></p>
  <ul>
    <li>💻 工具函数库：就像"代码工具箱"，提供各种常用的数据处理函数</li>
    <li>📊 数据处理：数组排序、对象合并、字符串处理等</li>
    <li>⚡ 快速使用：需要什么功能，直接调用函数，不用自己编写</li>
    <li>🔄 通用函数：这些函数可以在各种场景中使用</li>
  </ul>

  <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 15px;">
    <strong>💡 简单理解：</strong>工具函数库就像一个"代码工具箱"，提供了各种常用的数据处理工具，让你不用重复编写相同的代码。
  </div>
</div>

### ❓ 常见问题解答

<div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #2e7d32;">🤔 你可能想问的问题</h3>

  <h4 style="color: #388e3c;">Q1: 为什么需要这么多模块？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像建房子需要水管、电路、网络等不同系统一样，程序也需要不同的功能模块。每个模块负责一个特定功能，这样程序才能正常运行。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q2: 这些模块可以单独使用吗？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 可以！每个模块都是独立的，可以单独使用。比如你可以只用HTTP客户端来发送网络请求，或者只用状态管理来存储数据。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q3: 什么是"灵感自知名库"？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 就像学习做菜时参考名厨的菜谱一样，我们参考了优秀的开源库的设计思路，但根据我们的需求进行了简化和优化，让它更轻量、更适合我们的场景。</p>

  <h4 style="color: #388e3c; margin-top: 20px;">Q4: 这些模块会互相影响吗？</h4>
  <p style="margin-left: 20px;"><strong>A:</strong> 不会！每个模块都是独立的，它们可以互相配合使用，但不会互相干扰。就像房子的水管和电路系统，各自独立工作，但可以配合使用。</p>
</div>

## 📖 概述

<div style="background-color: #e8f4fd; padding: 20px; border-left: 5px solid #03a9f4; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #01579b;">🎨 "灵感自知名库"的设计哲学</h3>
  <p>WokeFlow 的核心功能模块采用了<strong>"灵感自知名库"</strong>的设计理念。我们不重新发明轮子，而是站在巨人的肩膀上，通过借鉴和简化流行开源库的核心功能，构建了一套轻量级的企业级应用组件。</p>
  <p><strong>设计目标</strong>：在保持<strong>轻量化</strong>的同时，提供<strong>企业级</strong>的稳定性和扩展性。</p>
  <blockquote style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0;">
    <strong>💡 核心思想</strong>：借鉴优秀开源库的设计精髓，结合 WokeFlow 的轻量化架构需求，进行创造性重构。
  </blockquote>
</div>

## 🏗️ 模块设计原则

### 1. 🎭 灵感借鉴理念

<div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #e65100;">📚 名库借鉴矩阵</h4>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="background-color: #ffe0b2;">
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">WokeFlow 模块</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">实际集成库</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">核心特性</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">集成优势</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>HTTP 客户端</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">Axios</td>
        <td style="padding: 8px; border: 1px solid #ddd;">拦截器、JSON转换</td>
        <td style="padding: 8px; border: 1px solid #ddd;">简化API、增强缓存</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>状态管理</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">Zustand</td>
        <td style="padding: 8px; border: 1px solid #ddd;">轻量级响应式</td>
        <td style="padding: 8px; border: 1px solid #ddd;">集成持久化、调试</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>消息队列</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">Bull.js</td>
        <td style="padding: 8px; border: 1px solid #ddd;">Redis驱动队列</td>
        <td style="padding: 8px; border: 1px solid #ddd;">企业级可靠、监控完善</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>事件系统</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">EventEmitter3</td>
        <td style="padding: 8px; border: 1px solid #ddd;">高性能事件发射</td>
        <td style="padding: 8px; border: 1px solid #ddd;">内存高效、API简单</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>认证授权</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">JWT</td>
        <td style="padding: 8px; border: 1px solid #ddd;">无状态令牌</td>
        <td style="padding: 8px; border: 1px solid #ddd;">多密钥轮换、黑名单</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>日期时间</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">Day.js</td>
        <td style="padding: 8px; border: 1px solid #ddd;">轻量化时间处理</td>
        <td style="padding: 8px; border: 1px solid #ddd;">中文本地化、工作日计算</td>
      </tr>
      <tr style="background-color: #fff8e1;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>工具函数</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">Lodash</td>
        <td style="padding: 8px; border: 1px solid #ddd;">函数式工具</td>
        <td style="padding: 8px; border: 1px solid #ddd;">精简核心函数、性能优化</td>
      </tr>
    </tbody>
  </table>
</div>

### 2. ⚡ 轻量化优化策略

<div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #7b1fa2;">🎯 优化目标</h4>
  <ul>
    <li><strong>🚀 性能优先</strong>：冷启动时间 < 2秒，内存占用 < 50MB</li>
    <li><strong>📦 最小化依赖</strong>：零外部运行时依赖，包体积最小化</li>
    <li><strong>🔧 简化API</strong>：直观的接口设计，降低学习成本</li>
    <li><strong>🛡️ 企业级稳定</strong>：完善的错误处理和边界情况处理</li>
  </ul>

  <h4 style="margin-top: 20px; color: #7b1fa2;">📊 集成优势对比</h4>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="background-color: #e1bee7;">
        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">特性</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">自建实现</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">开源集成</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">优势</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">维护成本</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">高</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">低</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">社区维护</td>
      </tr>
      <tr style="background-color: #f9f9f9;">
        <td style="padding: 8px; border: 1px solid #ddd;">稳定性</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">待验证</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">生产验证</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">企业级保障</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">功能丰富度</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">基础功能</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">功能完整</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">开箱即用</td>
      </tr>
      <tr style="background-color: #f9f9f9;">
        <td style="padding: 8px; border: 1px solid #ddd;">生态系统</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">无</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">完善</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">插件丰富</td>
      </tr>
    </tbody>
  </table>
</div>

### 3. 🧩 模块化架构设计

<div style="background-color: #e0f2f1; padding: 15px; border-radius: 8px; margin: 15px 0;">
  <h4 style="margin-top: 0; color: #00695c;">🔗 模块协作模式</h4>
  <ul>
    <li><strong>🎛️ 依赖注入集成</strong>：通过容器统一管理模块依赖关系</li>
    <li><strong>🔄 运行时插拔</strong>：支持模块的动态加载和替换</li>
    <li><strong>📏 统一生命周期</strong>：标准化的初始化、启动、停止流程</li>
    <li><strong>🎯 接口契约</strong>：明确的模块接口规范和版本控制</li>
  </ul>

  <h4 style="margin-top: 20px; color: #00695c;">🏛️ 架构优势</h4>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
    <div style="background-color: #b2dfdb; padding: 10px; border-radius: 5px;">
      <strong>🔧 可维护性</strong><br/>
      模块职责清晰，易于独立测试和更新
    </div>
    <div style="background-color: #b2dfdb; padding: 10px; border-radius: 5px;">
      <strong>📈 可扩展性</strong><br/>
      新功能可作为独立模块添加
    </div>
    <div style="background-color: #b2dfdb; padding: 10px; border-radius: 5px;">
      <strong>🧪 可测试性</strong><br/>
      模块独立测试，Mock依赖简单
    </div>
    <div style="background-color: #b2dfdb; padding: 10px; border-radius: 5px;">
      <strong>🚀 可重用性</strong><br/>
      模块可在不同项目中复用
    </div>
  </div>
</div>

## 核心功能模块详解

### 1. HTTP 客户端 (Axios)

#### 功能特性
- **请求/响应拦截器**: 支持在请求发送前和响应接收后进行处理
- **自动 JSON 转换**: 自动序列化和反序列化 JSON 数据
- **请求重试机制**: 支持指数退避重试策略
- **请求缓存**: 支持 GET 请求的结果缓存
- **并发控制**: 限制最大并发请求数量
- **超时管理**: 可配置的请求超时设置

#### 核心API

```javascript
import axios from 'axios';

// 创建实例
const httpClient = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 添加请求拦截器
httpClient.interceptors.request.use((config) => {
  // 添加认证头
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 添加响应拦截器
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 处理认证失败
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

// 发送请求
const response = await httpClient.request({
  method: 'GET',
  url: '/users',
  params: { page: 1, limit: 10 }
});

// 便捷方法
const users = await httpClient.get('/users');
const newUser = await httpClient.post('/users', { name: 'John' });
const updatedUser = await httpClient.put('/users/1', { name: 'Jane' });
await httpClient.delete('/users/1');
```

#### 使用场景
- RESTful API 调用
- 第三方服务集成
- 文件上传下载
- GraphQL 查询
- 微服务间通信

#### 配置选项

```javascript
const config = {
  baseURL: 'https://api.example.com',    // 基础URL
  timeout: 10000,                        // 超时时间(ms)
  headers: {                             // 默认请求头
    'Content-Type': 'application/json',
    'User-Agent': 'WokeFlow/1.0.0'
  },
  maxRequests: 1000,                     // 最大并发请求数
  retryAttempts: 3,                      // 重试次数
  retryDelay: 1000,                      // 重试延迟(ms)
  cacheEnabled: true,                    // 启用缓存
  cacheTTL: 300000                       // 缓存过期时间(ms)
};
```

#### 性能特性
- 请求缓存减少重复调用
- 连接池复用优化性能
- 自动压缩和解压缩
- 内存使用监控和限制

### 2. 状态管理 (Zustand)

#### 功能特性
- **响应式状态更新**: 状态变更自动通知订阅者
- **不可变状态**: 每次更新创建新状态对象
- **中间件支持**: 支持日志、持久化等中间件
- **选择器优化**: 支持状态选择器避免不必要的重渲染
- **动作记录**: 支持时间旅行调试
- **类型安全**: 支持 TypeScript 类型定义

#### 核心API

```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// 创建基础状态存储
const useCounterStore = create((set, get) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
  get double() { return get().count * 2; }
}));

// 使用开发工具中间件
const useDebugStore = create(
  devtools((set, get) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
    decrement: () => set((state) => ({ count: state.count - 1 }), false, 'decrement')
  }))
);

// 使用持久化中间件
const usePersistentStore = create(
  persist((set, get) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: state.count - 1 }))
  }), {
    name: 'counter-storage'
  })
);

// 使用状态存储
function CounterComponent() {
  const { count, increment, decrement } = useCounterStore();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

// 订阅状态变更
const unsubscribe = useCounterStore.subscribe((newState, oldState) => {
  console.log('状态变更:', newState, oldState);
});

// 直接更新状态
useCounterStore.setState({ count: 5 });

// 使用选择器 (通过useStore)
import { useStore } from 'zustand';
const count = useStore(useCounterStore, (state) => state.count);
```

#### 使用场景
- 全局应用状态管理
- 用户会话状态
- 表单状态管理
- UI 组件状态
- 缓存数据管理
- 配置状态存储

#### 中间件类型
- **日志中间件**: 记录所有状态变更
- **持久化中间件**: 自动保存状态到存储
- **验证中间件**: 验证状态变更的合法性
- **同步中间件**: 与外部服务同步状态
- **调试中间件**: 开发时的调试支持

#### 性能优化
- 浅比较避免不必要的通知
- 惰性订阅按需更新
- 批量更新减少通知次数
- 内存泄漏检测和清理

### 3. 消息队列 (Bull.js)

#### 功能特性
- **发布订阅模式**: 支持一对多消息分发
- **主题通配符**: 支持通配符匹配主题
- **队列组**: 支持负载均衡的消息消费
- **请求响应模式**: 支持同步请求响应
- **消息持久化**: 可选的消息持久化存储
- **连接管理**: 自动重连和连接池

#### 核心API

```javascript
import NATSInspiredMessaging from './core/NATSInspiredMessaging.js';

const messaging = new NATSInspiredMessaging();

// 连接到消息服务器
const connection = await messaging.connect('cluster-1');

// 发布消息
await messaging.publish('user.created', {
  id: 'user123',
  name: 'John Doe',
  email: 'john@example.com'
});

// 订阅消息
const subscription = messaging.subscribe('user.created', (message) => {
  console.log('新用户创建:', message);
  // 处理用户创建逻辑
});

// 取消订阅
messaging.unsubscribe('user.created', subscription.id);

// 请求响应模式
const response = await messaging.request('user.get', { id: 'user123' }, 5000);

// 队列组 (负载均衡)
messaging.subscribe('order.process', (message) => {
  // 只有队列组中的一个订阅者会收到消息
  processOrder(message);
}, null, 'order-queue-group');

// 通配符订阅
messaging.subscribe('user.*', (message, subject) => {
  console.log(`用户事件: ${subject}`, message);
});
```

#### 使用场景
- 事件驱动架构
- 微服务间通信
- 实时通知系统
- 任务队列处理
- 日志聚合系统
- 缓存失效通知

#### 消息模式
- **发布订阅**: 一对多异步通信
- **请求响应**: 同步请求响应模式
- **队列组**: 负载均衡消费
- **流处理**: 消息流处理和转换

#### 可靠性特性
- 消息确认机制
- 自动重连和重试
- 消息持久化选项
- 死信队列处理
- 流量控制和背压

### 4. 认证授权 (JWT)

#### 功能特性
- **无状态认证**: 基于 JWT 的无状态令牌认证
- **密钥轮换**: 支持多密钥管理和轮换
- **令牌刷新**: 支持访问令牌和刷新令牌
- **权限验证**: 基于角色的访问控制
- **令牌黑名单**: 支持令牌吊销
- **自动清理**: 过期令牌自动清理

#### 核心API

```javascript
import JWTInspiredAuth from './core/JWTInspiredAuth.js';

const auth = new JWTInspiredAuth();
await auth.initialize();

// 设置密钥
auth.setSecret('default', 'your-secret-key');
auth.setSecret('refresh', 'refresh-secret-key');

// 生成令牌
const accessToken = auth.generateToken({
  userId: 'user123',
  username: 'john',
  roles: ['user', 'admin']
}, 'default', {
  expiresIn: 3600, // 1小时
  issuer: 'wokeflow',
  audience: 'api'
});

// 生成刷新令牌
const refreshToken = auth.generateToken({
  userId: 'user123',
  type: 'refresh'
}, 'refresh', {
  expiresIn: 86400 // 24小时
});

// 验证令牌
try {
  const payload = auth.verifyToken(accessToken, 'default');
  console.log('用户认证成功:', payload);
} catch (error) {
  console.error('令牌验证失败:', error.message);
}

// 刷新令牌
const newTokens = auth.refreshTokenPair(refreshToken, 'refresh', 'default');

// 验证权限
if (auth.hasRole(accessToken, 'admin')) {
  // 执行管理员操作
}

// 吊销令牌
auth.revokeToken(accessToken);

// 批量验证
const tokens = ['token1', 'token2', 'token3'];
const validTokens = auth.verifyTokens(tokens, 'default');
```

#### 使用场景
- 用户登录认证
- API 访问授权
- 单页应用认证
- 微服务间认证
- 第三方集成认证
- 移动应用认证

#### 安全特性
- 强加密算法 (HS256, RS256)
- 令牌过期和刷新机制
- 防止重放攻击
- 安全的密钥管理
- 审计日志记录

#### 令牌格式
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT",
    "kid": "default"
  },
  "payload": {
    "userId": "user123",
    "username": "john",
    "roles": ["user"],
    "iat": 1640995200,
    "exp": 1641002400,
    "iss": "wokeflow",
    "aud": "api"
  },
  "signature": "base64-encoded-signature"
}
```

### 5. 日期时间处理 (Day.js)

#### 功能特性
- **轻量化设计**: 专注于常用日期操作
- **不可变操作**: 所有操作返回新实例
- **国际化支持**: 多语言日期格式化
- **相对时间**: 支持"3天前"等相对时间显示
- **时区处理**: 支持时区转换和本地化
- **插件扩展**: 支持自定义格式化和解析

#### 核心API

```javascript
import DayJSInspiredDate from './core/DayJSInspiredDate.js';

const dateUtil = new DayJSInspiredDate();
await dateUtil.initialize();

// 创建日期对象
const now = dateUtil.create();
const specificDate = dateUtil.create('2023-12-25');
const timestamp = dateUtil.create(1672531200000);

// 日期操作
const tomorrow = now.add(1, 'day');
const lastWeek = now.subtract(1, 'week');
const nextMonth = now.add(1, 'month');

// 格式化
console.log(now.format('YYYY-MM-DD HH:mm:ss')); // 2023-12-25 14:30:00
console.log(now.format('MMM DD, YYYY'));       // Dec 25, 2023
console.log(now.format('相对时间'));            // 5分钟前

// 解析
const parsed = dateUtil.parse('2023-12-25 15:30:00', 'YYYY-MM-DD HH:mm:ss');

// 比较
if (now.isBefore(tomorrow)) {
  console.log('现在比明天早');
}

if (dateUtil.isSame(now, specificDate, 'day')) {
  console.log('是同一天');
}

// 时区处理
const utc = now.utc();
const local = utc.local();
const nyTime = now.tz('America/New_York');

// 相对时间
console.log(dateUtil.fromNow(specificDate));     // 3天前
console.log(dateUtil.toNow(specificDate));       // 3天后

// 业务常用方法
const isWorkingDay = dateUtil.isWorkingDay(now);
const isHoliday = dateUtil.isHoliday(now, ['2023-12-25']);
const businessDays = dateUtil.businessDaysBetween(startDate, endDate);
```

#### 使用场景
- 用户界面日期显示
- 日程安排和提醒
- 报告生成和统计
- 缓存过期时间计算
- 业务规则日期判断
- 日志时间戳处理

#### 格式化选项
- **预设格式**: ISO, RFC, Unix 时间戳等
- **自定义格式**: 支持灵活的格式化模板
- **本地化**: 支持多语言月份和星期名称
- **相对格式**: "昨天"、"明天"、"下周"等

#### 日期操作
- **基本运算**: add, subtract, startOf, endOf
- **比较操作**: isBefore, isAfter, isSame
- **查询操作**: isLeapYear, isWorkingDay, isHoliday
- **业务方法**: businessDaysBetween, workingHoursBetween

### 6. 工具函数库 (Lodash)

#### 功能特性
- **函数式编程**: 支持链式调用和组合
- **类型安全**: 完善的类型检查和转换
- **性能优化**: 优化的算法和内存使用
- **模块化加载**: 支持按需导入
- **兼容性**: 保持与 Lodash API 的兼容性

#### 核心API

```javascript
import LodashInspiredUtils from './core/LodashInspiredUtils.js';

const utils = new LodashInspiredUtils();
await utils.initialize();

// 数组操作
const numbers = [1, 2, 3, 4, 5, 6];
const doubled = utils.map(numbers, n => n * 2);
const evens = utils.filter(numbers, n => n % 2 === 0);
const sum = utils.sum(numbers);
const unique = utils.uniq([1, 2, 2, 3, 3, 3]);
const chunks = utils.chunk(numbers, 2);

// 对象操作
const user = { id: 1, name: 'John', age: 30 };
const picked = utils.pick(user, ['name', 'age']);
const omitted = utils.omit(user, ['id']);
const merged = utils.merge({ a: 1 }, { b: 2 }, { c: 3 });

// 函数操作
const greet = (name) => `Hello ${name}`;
const greetLoudly = utils.compose(
  utils.toUpper,
  greet
);
console.log(greetLoudly('world')); // "HELLO WORLD"

const debouncedSearch = utils.debounce((query) => {
  searchAPI(query);
}, 300);

const throttledScroll = utils.throttle(() => {
  handleScroll();
}, 100);

// 字符串操作
const camelCase = utils.camelCase('hello world');      // helloWorld
const kebabCase = utils.kebabCase('HelloWorld');       // hello-world
const snakeCase = utils.snakeCase('HelloWorld');       // hello_world
const capitalized = utils.capitalize('hello world');   // Hello world

// 集合操作
const users = [
  { id: 1, name: 'John', department: 'IT' },
  { id: 2, name: 'Jane', department: 'HR' },
  { id: 3, name: 'Bob', department: 'IT' }
];

const grouped = utils.groupBy(users, 'department');
// { IT: [...], HR: [...] }

const sorted = utils.sortBy(users, 'name');
const found = utils.find(users, { department: 'IT' });

// 异步工具
const results = await utils.mapAsync(numbers, async n => {
  await delay(100);
  return n * 2;
});

const firstCompleted = await utils.race([
  fetch('/api/1'),
  fetch('/api/2'),
  fetch('/api/3')
]);
```

#### 使用场景
- 数据转换和处理
- 表单验证和清理
- API 响应格式化
- 状态计算和聚合
- 用户输入处理
- 缓存键生成

#### 性能优化
- **延迟求值**: 支持懒加载和流式处理
- **内存效率**: 迭代器和生成器支持
- **缓存机制**: 结果缓存避免重复计算
- **算法优化**: 使用高效的排序和搜索算法

#### 扩展机制
- **自定义函数**: 支持添加自定义工具函数
- **插件系统**: 可扩展的功能模块
- **类型扩展**: 支持自定义类型处理

## 模块集成和配置

### 依赖注入配置

```javascript
// 在容器中注册核心模块
container.register('http', AxiosInspiredHTTP);
container.register('state', ZustandInspiredState);
container.register('messaging', NATSInspiredMessaging);
container.register('auth', JWTInspiredAuth);
container.register('date', DayJSInspiredDate);
container.register('utils', LodashInspiredUtils);

// 服务中使用依赖注入
@Dependency('http', 'auth', 'state')
@Service('apiService')
class ApiService {
  async fetchUser(userId) {
    const token = this.auth.generateToken({ userId });
    return await this.http.get(`/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
```

### 模块间协作

```javascript
// HTTP 模块与认证模块协作
http.interceptors.request.use((config) => {
  const token = auth.getCurrentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 状态管理与消息传递协作
messaging.subscribe('user.updated', (userData) => {
  state.setState((prevState) => ({
    users: {
      ...prevState.users,
      [userData.id]: userData
    }
  }));
});

// 日期工具与其他模块协作
const lastLoginDisplay = date.format(user.lastLogin, '相对时间');
const tokenExpiry = date.add(now, 1, 'hour');
```

## 监控和调试

### 性能监控
- 请求响应时间统计
- 状态更新频率监控
- 消息传递吞吐量
- 内存使用情况跟踪
- 错误发生率统计

### 调试支持
- 详细的日志记录
- 状态变更追踪
- 消息流可视化
- 性能分析工具
- 开发时错误提示

## 总结

WokeFlow 的核心功能模块通过借鉴知名开源库的设计理念，提供了一套轻量级、高性能的企业级应用组件。这些模块保持了原库的核心功能和设计模式，同时针对轻量化架构进行了优化，既保证了功能完整性，又提升了运行效率和开发体验。
