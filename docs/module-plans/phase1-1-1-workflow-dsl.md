# 📝 Phase 1.1.1: 完善工作流定义DSL

## 🎯 模块目标

**设计和实现简洁高效的工作流定义语言，专注于工作流的结构定义、节点配置和流程控制，确保DSL的精确性、可验证性和高性能。**

### 核心价值

- **精确表达**：清晰定义工作流逻辑和数据流
- **类型安全**：严格的语法验证和类型检查
- **高性能**：优化的解析和执行效率
- **易维护**：标准化格式便于版本控制

### 成功标准

- DSL语法覆盖80%的常见工作流模式
- 解析性能<50ms (中等复杂度)
- 验证准确率>95%
- 开发者学习时间<1小时

---

## 📊 详细任务分解

### 1.1.1.1 核心DSL语法设计 (2周)

#### 目标

设计简洁、强大的DSL语法，专注于工作流定义的核心要素。

#### 具体任务

**1.1.1.1.1 工作流结构定义**

```yaml
workflow:
  id: 'order-processing'
  name: '订单处理流程'
  version: '1.0.0'
  description: '处理客户订单的完整流程'

  # 流程起点
  start: 'receive-order'

  # 节点定义
  nodes:
    receive-order:
      type: 'trigger'
      config:
        type: 'webhook'
        path: '/orders'

    validate-order:
      type: 'task'
      config:
        action: 'validate'
        schema: 'order-schema'

    process-payment:
      type: 'task'
      config:
        action: 'payment'
        provider: 'stripe'

    ship-order:
      type: 'task'
      config:
        action: 'shipping'
        method: 'express'

  # 连接定义
  connections:
    - from: 'receive-order'
      to: 'validate-order'

    - from: 'validate-order'
      to: 'process-payment'
      condition: 'order.valid == true'

    - from: 'process-payment'
      to: 'ship-order'
      condition: "payment.status == 'completed'"
```

**1.1.1.1.2 节点类型系统**

- **trigger**：触发器节点，流程起点
- **task**：任务节点，执行具体操作
- **decision**：判断节点，条件分支
- **parallel**：并行节点，并发执行
- **end**：结束节点，流程终点

**1.1.1.1.3 数据流定义**

- **变量声明**：工作流级别的状态变量
- **输入映射**：节点输入数据的映射规则
- **输出映射**：节点输出数据的映射规则
- **表达式支持**：简单的条件判断和数据转换

#### 验收标准

- ✅ 语法简洁直观，易于理解
- ✅ 支持核心工作流模式
- ✅ 数据流定义清晰明确
- ✅ 兼容性设计良好

---

### 1.1.1.2 DSL解析与验证 (2周)

#### 目标

实现高效的DSL解析器和严格的验证机制。

#### 具体任务

**1.1.1.2.1 解析器实现**

- **YAML解析**：使用成熟的YAML解析库
- **结构转换**：将DSL转换为内部工作流模型
- **错误处理**：提供详细的解析错误信息和位置
- **性能优化**：缓存解析结果，避免重复解析

**1.1.1.2.2 验证系统**

- **语法验证**：检查必需字段、格式正确性
- **结构验证**：验证工作流图的连通性和逻辑性
- **引用验证**：检查节点和连接的引用正确性
- **类型验证**：验证配置参数的类型匹配

**1.1.1.2.3 错误报告系统**

```yaml
errors:
  - type: 'missing_required_field'
    message: "缺少必需字段 'start'"
    location: 'line 3, column 1'
    suggestion: '添加 ''start: "node-id"'' 来指定流程起点'

  - type: 'invalid_node_reference'
    message: "节点 'nonexistent-node' 不存在"
    location: 'line 25, column 8'
    suggestion: '检查节点ID拼写或添加缺失的节点定义'
```

#### 验收标准

- ✅ 解析速度快，内存使用合理
- ✅ 验证全面准确，覆盖主要错误场景
- ✅ 错误提示清晰，提供修复建议
- ✅ 支持增量验证，提升开发体验

---

### 1.1.1.3 基础工具支持 (1周)

#### 目标

提供基础的DSL开发和调试工具。

#### 具体任务

**1.1.1.3.1 命令行验证工具**

```bash
# 验证DSL文件
frys workflow validate workflow.yaml

# 格式化DSL文件
frys workflow format workflow.yaml

# 预览工作流结构
frys workflow preview workflow.yaml
```

**1.1.1.3.2 基础文档和示例**

- **语法参考**：完整的DSL语法规范
- **示例集合**：常见工作流模式的YAML示例
- **快速开始**：5分钟上手指南
- **故障排除**：常见错误及解决方案

#### 验收标准

- ✅ 命令行工具简单易用
- ✅ 文档内容准确，示例实用
- ✅ 工具运行稳定，无崩溃
- ✅ 错误输出清晰，有帮助性

---

## 🔧 技术实现方案

### 核心架构

```
DSL文件 → YAML解析 → 结构验证 → 模型转换 → 工作流对象
     ↓
错误收集 ← 语法检查 ← 引用检查 ← 类型检查 ←
```

### 关键组件

```typescript
interface DSLParser {
  parse(content: string): WorkflowDefinition;
  validate(definition: WorkflowDefinition): ValidationResult;
  format(definition: WorkflowDefinition): string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  start: string;
  nodes: Record<string, NodeDefinition>;
  connections: ConnectionDefinition[];
}

interface NodeDefinition {
  id: string;
  type: NodeType;
  name?: string;
  config: Record<string, any>;
  conditions?: Condition[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: string;
  message: string;
  location: {
    line: number;
    column: number;
    path: string;
  };
  suggestion?: string;
}
```

### 技术选型

- **YAML解析**：js-yaml (成熟稳定)
- **验证引擎**：ajv (JSON Schema验证)
- **错误处理**：自定义错误分类和报告
- **CLI工具**：commander.js

---

## 📅 时间安排

### Week 1-2: 核心语法设计

- 工作流结构和节点类型定义
- 连接和条件语法设计
- YAML格式规范制定

### Week 3-4: 解析与验证实现

- YAML解析器集成
- 结构验证逻辑开发
- 错误报告系统实现
- 性能优化和测试

### Week 5: 基础工具开发

- CLI工具核心功能
- 文档和示例编写
- 集成测试和调试

---

## 🎯 验收标准

### 功能验收

- [ ] DSL语法完整，支持核心工作流模式定义
- [ ] 解析器正常工作，验证机制准确有效
- [ ] 基础工具可用，文档和示例完善

### 性能验收

- [ ] 解析时间<50ms (复杂工作流)
- [ ] 验证时间<100ms
- [ ] 内存占用<20MB

### 用户验收

- [ ] 开发者能快速掌握DSL语法
- [ ] 错误提示有助于定位和解决问题
- [ ] 工具提升开发效率

---

## 👥 团队配置

### 核心团队 (2人)

- **DSL设计师**：1人 (语法设计，规范制定)
- **后端工程师**：1人 (解析器实现，验证逻辑)

---

## 💰 预算规划

### 人力成本 (5周)

- DSL设计师：1人 × ¥30,000/月 × 1.25个月 = ¥37,500
- 后端工程师：1人 × ¥25,000/月 × 1.25个月 = ¥31,250
- **人力小计**：¥68,750

### 技术成本

- 开发工具：¥5,000
- **技术小计**：¥5,000

### 总预算：¥73,750

这个精简的DSL完善方案聚焦于工作流定义的核心功能，为frys工作流引擎提供坚实的基础。
