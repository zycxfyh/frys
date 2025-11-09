# 快速开始

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

## 运行测试

```bash
# 单元测试
npm run test:unit

# 集成测试 (需要先配置数据库)
npm run test:integration
```

## 基本使用

```javascript
import { WorkflowEngine } from 'frys';

const engine = new WorkflowEngine();
```
