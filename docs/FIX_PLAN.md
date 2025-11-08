# 修复计划：wokeflow-debug 核心问题与改进方案

## 背景
当前仓库基于「frys」工作流平台的大型重构版本，核心模块已经重写为轻量化、分层化架构。但在运行入口 `src/index.js` 所依赖的基础设施尚未完全打通，导致系统无法正常启动。以下计划基于对 `src/`、`config/` 与共享工具的全面审查，梳理出影响启动稳定性的关键缺陷，并给出分步修复方案。

## 核心问题清单
1. **结构化日志器不兼容 `BaseModule`**  
   `src/core/BaseModule.js` 在构造函数中调用 `logger.child(...)`，但 `src/shared/utils/logger.js` 的 `StructuredLogger` 未实现 `child` 方法，导致任意模块实例化都会抛出 `TypeError: logger.child is not a function`。

2. **Sentry 配置访问空对象并且环境变量未正确加载**  
   - `src/core/ErrorHandlerConfig.js` 在判定 `config.sentry?.dsn` 后，仍直接访问 `config.sentry.dsn`，在默认配置缺失 `sentry` 键时抛出异常。  
   - `src/shared/utils/config.js` 的 `loadEnvConfig` 读取 `test.env`/`.env` 的路径错误，应指向 `config/env/`。目前所有私密配置（如 `JWT_SECRET`）均未注入。

3. **依赖注入容器未注册基础服务**  
   `src/core/container.js` 只注入 `eventSystem`、`errorHandler`、`pluginManager` 等，`WorkflowEngine`/`UserService` 所依赖的 `http`、`auth`、`state`、`messaging`、`utils`、`date` 均未注册或初始化，`container.resolve()` 会同步抛错。

4. **JWT 模块使用浏览器 API 导致 Node 环境失败**  
   `src/core/JWTInspiredAuth.js` 直接调用 `btoa`/`atob`，在 Node.js 环境下不存在，对令牌生成/校验造成崩溃。

## 修复方案

### 1. 为 `StructuredLogger` 增加 `child` 支持
- 在 `src/shared/utils/logger.js` 中新增 `child(context = {})` 方法，返回共享传输器的派生实例，并合并上下文（可复用 `setGlobalContext` 或封装新的 `StructuredLogger` 子类）。  
- 确保 `child` 返回对象具备完整日志 API（`info`/`error` 等），同时延续请求上下文与全局配置。

### 2. 修复配置加载与 Sentry 判定
- 在 `config` 生成时追加安全的 `sentry` 默认对象，例如：
  ```js
  sentry: {
    dsn: getEnvVar('SENTRY_DSN'),
    tracesSampleRate: safeParseFloat(getEnvVar('SENTRY_TRACES_SAMPLE_RATE', '0.1'), 0.1),
    ...
  }
  ```
- `loadEnvConfig` 调整为 `join(__dirname, '../../../config/env/', envFile)`，并兼容 Windows 路径。  
- 在 `ErrorHandlerConfig` 中将 `config.sentry.dsn` 改为安全访问（`config.sentry?.dsn`），并在构造 Sentry 配置时尽量从局部变量读取，防止未配置时取值。

### 3. 完成依赖注入容器的基础注册
- 在 `loadCoreModules()` 完成后，增加如下注册：
  ```js
  const { default: AxiosInspiredHTTP } = await import('./AxiosInspiredHTTP.js');
  const { default: JWTInspiredAuth } = await import('./JWTInspiredAuth.js');
  const { default: DayJSInspiredDate } = await import('./DayJSInspiredDate.js');
  const { default: LodashInspiredUtils } = await import('./LodashInspiredUtils.js');
  const { default: ZustandInspiredState } = await import('./ZustandInspiredState.js');
  const { messagingAdapter } = await import('./MessagingAdapter.js');

  container.register({
    http: asClass(AxiosInspiredHTTP).singleton(),
    auth: asClass(JWTInspiredAuth).singleton(),
    date: asClass(DayJSInspiredDate).singleton(),
    utils: asClass(LodashInspiredUtils).singleton(),
    state: asClass(ZustandInspiredState).singleton(),
  });
  container.register({
    messaging: asValue(messagingAdapter),
  });
  ```
- 在 `initializeCoreServices` 中调用 `initialize()` 钩子（若模块继承 `BaseModule`），并处理异步初始化失败的日志。

### 4. 替换 JWT 模块中的浏览器编码函数
- 将 `btoa`/`atob` 改为使用 `Buffer.from(...).toString('base64')` 与 `Buffer.from(..., 'base64').toString('utf8')` 的 URL-safe 变体。  
- 同时更新 `createSignature` 的实现或至少将 `Buffer` 用于编码，避免因 `btoa` 缺失导致的 `ReferenceError`。

## 验证与测试
1. 单元测试  
   - 新增或修复 `src/core/__tests__/StructuredLogger.test.js`（如无则创建）验证 `child()`。  
   - 针对 `JWTInspiredAuth` 增加 token 生成/验证测试，确保 Node 环境通过。

2. 集成测试  
   - 运行 `pnpm test:unit` 与 `pnpm test:integration`，重点关注容器初始化、`/health` 路由返回。  
   - 若 Redis 未配置，可在测试中 mock `messagingAdapter` 或通过环境变量禁用队列。

3. 手动验证  
   - `pnpm dev` 观察启动日志应显示核心模块初始化成功。  
   - 调用 `GET /health`，确认 services 中 `http` / `auth` / `state` / `messaging` 状态为 `healthy` 或有效对象。

## 风险与后续注意事项
- **容器初始化顺序**：新增注册顺序需确保 `logger` 等基础依赖已就绪，避免循环依赖。  
- **Sentry 默认配置**：若生产环境真需要上报，需在部署前提供有效 `SENTRY_DSN`。  
- **Bull/Redis 依赖**：`MessagingAdapter` 在本地无 Redis 时会输出警告，应在文档中说明可通过环境变量禁用或使用内存队列。  
- **BaseModule 构造参数**：当前多个模块 `super('xxx')` 的写法虽然不会立即崩溃，但不符合预期（会把字符串拆成索引配置）。建议在后续代码清理中统一改为 `super()` 并使用类名作为模块标识。

---
**下一步行动**：按上述四大块依次提交修复，优先解决 `logger` 与容器注册问题，确保主流程可运行；随后完善配置加载与 JWT 编码，最后补充测试覆盖率。***

