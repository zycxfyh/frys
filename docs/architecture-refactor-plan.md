# 🔧 代码架构重构计划

## 📊 当前架构问题分析

### 现状问题
- **文件数量过多**：src/ 下129个文件，结构扁平
- **命名不规范**：存在 "Inspired" 命名，缺乏统一标准
- **职责不清**：文件分布散乱，功能耦合严重
- **依赖混乱**：循环依赖，导入路径复杂

### 具体问题清单
1. **目录结构**：
   - `core/` 目录下49个文件，功能杂糅
   - `infrastructure/` 下文件过多，职责不清
   - 重复文件：`ConsulInspiredDiscovery.js.backup`

2. **命名问题**：
   - `AxiosInspiredHTTP.js` - 直接抄袭库名
   - `JWTInspiredAuth.js` - 命名不专业
   - 文件名大小写不统一

3. **依赖问题**：
   - 循环依赖：A导入B，B导入A
   - 过度抽象：很多不必要的抽象层
   - 未使用代码：冗余的工具函数

---

## 🎯 重构目标架构

### 核心原则
- **职责单一**：每个模块职责清晰
- **依赖明确**：单向依赖，无循环引用
- **命名规范**：专业、统一、可读性强
- **结构清晰**：按功能分组，易于理解

### 新目录结构设计

```
src/
├── core/                    # 核心业务逻辑 (精简)
│   ├── workflow/           # 工作流引擎核心
│   │   ├── WorkflowEngine.js
│   │   ├── WorkflowParser.js
│   │   ├── WorkflowExecutor.js
│   │   └── WorkflowState.js
│   ├── plugin/             # 插件系统核心
│   │   ├── PluginManager.js
│   │   ├── PluginLoader.js
│   │   └── PluginSandbox.js
│   ├── event/              # 事件系统
│   │   ├── EventBus.js
│   │   ├── EventEmitter.js
│   │   └── EventStore.js
│   └── container.js        # 依赖注入容器
├── domain/                 # 领域层 (业务实体和规则)
│   ├── entities/           # 领域实体
│   │   ├── Workflow.js
│   │   ├── WorkflowInstance.js
│   │   ├── Plugin.js
│   │   └── User.js
│   ├── services/           # 领域服务
│   │   ├── WorkflowDomainService.js
│   │   ├── PluginDomainService.js
│   │   └── AuthDomainService.js
│   └── repositories/       # 仓储接口
│       ├── interfaces/
│       └── implementations/
├── application/            # 应用层 (用例和DTO)
│   ├── use-cases/          # 应用用例
│   │   ├── CreateWorkflow.js
│   │   ├── ExecuteWorkflow.js
│   │   └── ManagePlugins.js
│   ├── services/           # 应用服务
│   │   ├── WorkflowApplicationService.js
│   │   └── PluginApplicationService.js
│   └── dto/                # 数据传输对象
├── infrastructure/         # 基础设施层 (外部接口)
│   ├── web/                # Web接口
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── middleware/
│   ├── persistence/        # 数据持久化
│   │   ├── database/
│   │   ├── cache/
│   │   └── file-system/
│   ├── external/           # 外部服务集成
│   │   ├── http-client/
│   │   ├── message-queue/
│   │   └── cloud-services/
│   ├── monitoring/         # 监控和日志
│   └── security/           # 安全相关
├── shared/                 # 共享工具和常量
│   ├── utils/              # 通用工具函数
│   ├── constants/          # 常量定义
│   ├── types/              # TypeScript类型定义
│   └── errors/             # 自定义错误类
└── index.js               # 应用入口
```

### 架构优势

1. **清晰的分层**：
   - **Domain**: 核心业务逻辑，独立于外部框架
   - **Application**: 应用用例，协调领域对象
   - **Infrastructure**: 外部接口适配器，可替换

2. **依赖方向**：
   ```
   Infrastructure → Application → Domain
   ```

3. **模块职责**：
   - 每个目录职责单一
   - 文件命名反映功能
   - 导入路径简洁明确

---

## 📋 重构执行计划

### Phase 1.1.1: 目录结构重新设计 (1周)

#### 目标
创建新的目录结构，迁移核心文件

#### 具体任务

**1. 创建新目录结构**
```bash
# 创建基础目录
mkdir -p src/core/{workflow,plugin,event}
mkdir -p src/domain/{entities,services,repositories/{interfaces,implementations}}
mkdir -p src/application/{use-cases,services,dto}
mkdir -p src/infrastructure/{web/{controllers,routes,middleware},persistence/{database,cache,file-system},external/{http-client,message-queue,cloud-services},monitoring,security}
mkdir -p src/shared/{utils,constants,types,errors}
```

**2. 核心文件迁移**
- `core/WorkflowEngine.js` → `core/workflow/WorkflowEngine.js`
- `core/PluginManager.js` → `core/plugin/PluginManager.js`
- `core/events.js` → `core/event/EventBus.js`
- `domain/entities/auth/User.js` → `domain/entities/User.js`
- `infrastructure/database/DatabaseService.js` → `infrastructure/persistence/database/DatabaseService.js`

#### 验收标准
- ✅ 新目录结构完整创建
- ✅ 核心文件迁移完成
- ✅ 基础功能文件就位
- ✅ 导入路径更新

### Phase 1.1.2: 移除临时和冗余文件 (2天)

#### 目标
清理项目中的垃圾文件和冗余代码

#### 具体任务

**1. 识别冗余文件**
```bash
# 查找备份文件
find . -name "*.backup" -o -name "*.bak" -o -name "*~" -o -name "*.orig"

# 查找未使用的文件
find src -name "*.js" -exec grep -l "TODO.*REMOVE\|FIXME.*DELETE" {} \;
```

**2. 清理规则**
- 删除所有 `.backup` 和 `.bak` 文件
- 移除未使用的工具函数
- 清理注释掉的代码块
- 删除测试中未使用的mock文件

#### 验收标准
- ✅ 所有备份文件已删除
- ✅ 未使用代码已清理
- ✅ 项目大小减少20%
- ✅ git历史清理

### Phase 1.1.3: 命名规范化 (3天)

#### 目标
统一文件和函数的命名规范

#### 具体任务

**1. 文件命名规范**
```javascript
// ❌ 错误的命名
AxiosInspiredHTTP.js
JWTInspiredAuth.js
ConsulInspiredDiscovery.js

// ✅ 正确的命名
HttpClient.js
JwtAuthService.js
ServiceDiscovery.js
```

**2. 函数命名规范**
```javascript
// ❌ 错误的命名
get_user_by_id()
fetchDataFromAPI()
process_data_and_return()

// ✅ 正确的命名
getUserById()
fetchDataFromApi()
processData()
```

**3. 常量命名规范**
```javascript
// ❌ 错误的命名
MAX_RETRY_COUNT = 3
default_timeout = 5000

// ✅ 正确的命名
MAX_RETRY_COUNT = 3
DEFAULT_TIMEOUT_MS = 5000
```

#### 验收标准
- ✅ 文件命名符合驼峰规范
- ✅ 函数命名语义清晰
- ✅ 常量命名全大写下划线
- ✅ 命名与功能一致

### Phase 1.1.4: 导入管理整理 (2天)

#### 目标
移除循环依赖，优化导入结构

#### 具体任务

**1. 依赖分析**
```bash
# 使用工具分析依赖关系
npx madge --circular src/
npx madge --orphans src/
```

**2. 循环依赖解决**
- 提取共同接口到shared层
- 使用依赖注入替代直接导入
- 重构模块职责，减少耦合

**3. 导入优化**
- 使用相对路径替代绝对路径
- 按字母顺序整理导入语句
- 移除未使用的导入

#### 验收标准
- ✅ 无循环依赖
- ✅ 导入路径清晰
- ✅ 模块职责明确
- ✅ 代码可维护性提升

---

## 📊 重构进度跟踪

### 每日进度报告
- **Day 1-2**: 目录结构创建，核心文件迁移
- **Day 3**: 冗余文件清理
- **Day 4-6**: 命名规范化重构
- **Day 7**: 导入管理和依赖优化

### 质量保证
- **单元测试**: 确保重构不破坏功能
- **集成测试**: 验证模块间协作正常
- **性能测试**: 监控重构对性能的影响

### 回滚计划
- **每日备份**: git commit 记录重构进度
- **关键节点**: 完成主要模块时创建tag
- **应急恢复**: 保留原代码分支以备回滚

---

## 🎯 重构完成标准

### 功能完整性
- [ ] 所有现有功能正常工作
- [ ] API接口保持向后兼容
- [ ] 配置文件格式不变

### 代码质量提升
- [ ] 代码行数减少20%
- [ ] 循环依赖完全消除
- [ ] 文件命名规范统一
- [ ] 导入结构清晰

### 可维护性改善
- [ ] 新功能开发时间减少50%
- [ ] 代码审查效率提升
- [ ] 模块职责清晰明确
- [ ] 文档更新完整

### 性能和稳定性
- [ ] 启动时间无明显变化
- [ ] 内存使用保持稳定
- [ ] 测试通过率>95%

---

## 💪 执行建议

### 分步执行原则
1. **从小模块开始**：先重构核心模块，建立信心
2. **逐步迁移**：分批迁移文件，确保每步可验证
3. **并行测试**：重构过程中持续运行测试
4. **及时反馈**：每日总结进展，调整计划

### 风险控制
1. **备份策略**：git分支保护，重构前创建备份分支
2. **渐进式**：每次只改动少量文件，立即验证
3. **团队协作**：如果是团队项目，确保沟通顺畅

### 预期收益
- **开发效率提升**：新功能开发速度加快
- **维护成本降低**：代码更容易理解和修改
- **团队协作改善**：代码规范统一，冲突减少
- **产品质量提升**：结构清晰，bug更少

**让我们从创建新目录结构开始，重构之旅！** 🚀
