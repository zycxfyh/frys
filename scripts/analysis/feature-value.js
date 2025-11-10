/**
 * 功能价值评估脚本
 * 基于代码分析结果，对功能模块进行价值评估
 */

import fs from 'fs';

class FeatureValueAnalyzer {
  constructor() {
    this.dependencyMap = null;
    this.modules = new Map();
    this.assessment = new Map();
  }

  async analyze() {
    console.log('🎯 开始功能价值评估...');

    // 加载依赖分析结果
    await this.loadDependencyData();

    // 分析核心功能价值
    await this.analyzeCoreFeatures();

    // 分析基础设施价值
    await this.analyzeInfrastructure();

    // 分析工具类价值
    await this.analyzeUtilities();

    // 生成评估报告
    this.generateAssessmentReport();

    // 输出重构建议
    this.generateRefactorRecommendations();
  }

  async loadDependencyData() {
    try {
      const data = fs.readFileSync('dependency-map.json', 'utf8');
      this.dependencyMap = JSON.parse(data);

      // 转换为Map格式便于查询
      Object.entries(this.dependencyMap.modules).forEach(([name, module]) => {
        this.modules.set(name, module);
      });

      console.log(`📊 已加载 ${this.modules.size} 个模块的分析数据`);
    } catch (error) {
      console.error('❌ 无法加载依赖分析数据:', error.message);
      process.exit(1);
    }
  }

  async analyzeCoreFeatures() {
    console.log('\n🔍 分析核心功能价值...');

    // 核心工作流引擎
    this.assessFeature('core/AsyncWorkflowExecutor', {
      category: 'CORE_WORKFLOW',
      value: 'CRITICAL',
      reason: '实现了4种高级调度算法，复杂依赖分析，是系统核心',
      lines: this.getModuleLines('core/AsyncWorkflowExecutor'),
      dependencies: this.getModuleDependencies('core/AsyncWorkflowExecutor'),
      recommendation: '保留并优化 - 这是系统的核心竞争力'
    });

    // 智能回退系统
    this.assessFeature('core/SmartRollbackManager', {
      category: 'CORE_ROLLBACK',
      value: 'CRITICAL',
      reason: '5种回退策略，企业级故障恢复机制',
      lines: this.getModuleLines('core/SmartRollbackManager'),
      dependencies: this.getModuleDependencies('core/SmartRollbackManager'),
      recommendation: '保留 - 企业级高可用性保障'
    });

    // 记忆网络
    this.assessFeature('core/MemoryNetwork', {
      category: 'CORE_AI',
      value: 'HIGH',
      reason: '跨会话记忆，知识图谱，AI会话增强功能',
      lines: this.getModuleLines('core/MemoryNetwork'),
      dependencies: this.getModuleDependencies('core/MemoryNetwork'),
      recommendation: '保留 - AI功能增强，考虑独立模块'
    });

    // 分布式部署
    this.assessFeature('core/DistributedDeployment', {
      category: 'CORE_DISTRIBUTED',
      value: 'HIGH',
      reason: '分布式节点管理，智能负载均衡，集群部署',
      lines: this.getModuleLines('core/DistributedDeployment'),
      dependencies: this.getModuleDependencies('core/DistributedDeployment'),
      recommendation: '保留 - 云原生分布式支持'
    });
  }

  async analyzeInfrastructure() {
    console.log('\n🏗️ 分析基础设施价值...');

    // 压力测试工具
    this.assessFeature('infrastructure/benchmarking/StressTester', {
      category: 'INFRA_TESTING',
      value: 'HIGH',
      reason: '企业级压力测试，6种测试模式，故障注入，混沌工程',
      lines: this.getModuleLines('infrastructure/benchmarking/StressTester'),
      dependencies: this.getModuleDependencies('infrastructure/benchmarking/StressTester'),
      recommendation: '保留 - 专业级测试工具，可考虑开源独立'
    });

    // 数据库连接池
    this.assessFeature('infrastructure/database/DatabaseConnectionPool', {
      category: 'INFRA_DATABASE',
      value: 'HIGH',
      reason: '高级连接池算法，自适应扩展，健康检查',
      lines: this.getModuleLines('infrastructure/database/DatabaseConnectionPool'),
      dependencies: this.getModuleDependencies('infrastructure/database/DatabaseConnectionPool'),
      recommendation: '保留 - 生产级数据库管理'
    });

    // 自动扩容
    this.assessFeature('infrastructure/scaling/AutoScalingManager', {
      category: 'INFRA_SCALING',
      value: 'HIGH',
      reason: '预测性扩容，成本优化，多策略融合',
      lines: this.getModuleLines('infrastructure/scaling/AutoScalingManager'),
      dependencies: this.getModuleDependencies('infrastructure/scaling/AutoScalingManager'),
      recommendation: '保留 - 云原生自动扩容'
    });

    // 分布式追踪
    this.assessFeature('infrastructure/tracing/SamplingStrategy', {
      category: 'INFRA_TRACING',
      value: 'HIGH',
      reason: '6种采样策略，机器学习采样，智能采样率调整',
      lines: this.getModuleLines('infrastructure/tracing/SamplingStrategy'),
      dependencies: this.getModuleDependencies('infrastructure/tracing/SamplingStrategy'),
      recommendation: '保留 - 可观测性核心组件'
    });

    // 缓存管理
    this.assessFeature('infrastructure/persistence/CacheManager', {
      category: 'INFRA_CACHE',
      value: 'MEDIUM',
      reason: '复杂的缓存策略实现，多层缓存管理',
      lines: this.getModuleLines('infrastructure/persistence/CacheManager'),
      dependencies: this.getModuleDependencies('infrastructure/persistence/CacheManager'),
      recommendation: '优化 - 简化配置，提高易用性'
    });
  }

  async analyzeUtilities() {
    console.log('\n🔧 分析工具类价值...');

    // HTTP客户端
    this.assessFeature('core/AxiosInspiredHTTP', {
      category: 'UTIL_HTTP',
      value: 'MEDIUM',
      reason: 'axios封装，测试模式支持，请求拦截',
      lines: this.getModuleLines('core/AxiosInspiredHTTP'),
      dependencies: this.getModuleDependencies('core/AxiosInspiredHTTP'),
      recommendation: '重命名并优化 - 移除Inspired后缀，标准化命名'
    });

    // 监控指标
    this.assessFeature('core/PrometheusInspiredMetrics', {
      category: 'UTIL_METRICS',
      value: 'MEDIUM',
      reason: '完整的指标收集系统，多种指标类型',
      lines: this.getModuleLines('core/PrometheusInspiredMetrics'),
      dependencies: this.getModuleDependencies('core/PrometheusInspiredMetrics'),
      recommendation: '重命名 - MetricsCollector，集成到监控系统'
    });

    // 工具函数
    this.assessFeature('core/LodashInspiredUtils', {
      category: 'UTIL_TOOLS',
      value: 'LOW',
      reason: '简单的工具函数集合，lodash可以替代',
      lines: this.getModuleLines('core/LodashInspiredUtils') || 150,
      dependencies: this.getModuleDependencies('core/LodashInspiredUtils') || 0,
      recommendation: '移除 - 使用lodash库替代'
    });

    // 其他Inspired文件
    const inspiredFiles = [
      'core/ZodInspiredValidation',
      'core/ZustandInspiredState',
      'core/VitestInspiredTesting',
      'core/ViteInspiredBuild',
      'core/UUIDInspiredId',
      'core/SQLiteInspiredDatabase',
      'core/ProtocolBuffersInspiredSerialization',
      'core/PrismaInspiredORM',
      'core/PrettierInspiredFormatting',
      'core/OpenAPIInspiredDocs',
      'core/NATSInspiredMessaging',
      'core/LernaInspiredMonorepo',
      'core/JWTInspiredAuth',
      'core/JaegerInspiredTracing',
      'core/HuskyInspiredHooks',
      'core/FluentdInspiredLogging',
      'core/FastifyInspiredFramework',
      'core/ESLintInspiredLinting',
      'core/DayJSInspiredDate',
      'core/D3InspiredVisualization',
      'core/ConsulInspiredDiscovery'
    ];

    inspiredFiles.forEach(file => {
      const moduleName = file.replace('core/', '');
      this.assessFeature(file, {
        category: 'UTIL_INSPIRED',
        value: 'MEDIUM',
        reason: `${moduleName.replace('Inspired', '')}功能的封装实现`,
        lines: this.getModuleLines(file) || 100,
        dependencies: this.getModuleDependencies(file) || 0,
        recommendation: `重命名 - 移除Inspired后缀，使用标准名称`
      });
    });
  }

  assessFeature(moduleName, assessment) {
    // 获取实际的模块信息
    const moduleInfo = this.modules.get(moduleName);

    if (moduleInfo) {
      assessment.lines = moduleInfo.lines || assessment.lines;
      assessment.complexity = moduleInfo.complexity || 0;
    }

    // 计算综合价值分数
    assessment.score = this.calculateValueScore(assessment);

    this.assessment.set(moduleName, assessment);
  }

  calculateValueScore(assessment) {
    const valueWeights = {
      'CRITICAL': 100,
      'HIGH': 80,
      'MEDIUM': 60,
      'LOW': 40
    };

    let score = valueWeights[assessment.value] || 50;

    // 复杂度加成 (适当复杂度是好的)
    if (assessment.complexity > 50) score += 10;
    else if (assessment.complexity < 10) score -= 10;

    // 代码行数加成 (适当大小是好的)
    if (assessment.lines > 1000) score += 5; // 大文件可能包含重要功能
    else if (assessment.lines < 50) score -= 5; // 太小的文件可能不重要

    return Math.min(100, Math.max(0, score));
  }

  getModuleLines(moduleName) {
    const module = this.modules.get(moduleName);
    return module ? module.lines : 0;
  }

  getModuleDependencies(moduleName) {
    const module = this.modules.get(moduleName);
    return module ? module.imports.length : 0;
  }

  generateAssessmentReport() {
    console.log('\n📊 功能价值评估报告');
    console.log('='.repeat(60));

    // 按价值排序显示
    const sortedAssessments = Array.from(this.assessment.entries())
      .sort((a, b) => b[1].score - a[1].score);

    console.log('\n🏆 核心功能 (价值>80):');
    sortedAssessments
      .filter(([_, assessment]) => assessment.score > 80)
      .forEach(([name, assessment]) => {
        console.log(`✅ ${name}: ${assessment.score}分 - ${assessment.reason}`);
      });

    console.log('\n🔧 重要功能 (价值60-80):');
    sortedAssessments
      .filter(([_, assessment]) => assessment.score >= 60 && assessment.score <= 80)
      .forEach(([name, assessment]) => {
        console.log(`⚠️  ${name}: ${assessment.score}分 - ${assessment.reason}`);
      });

    console.log('\n📦 可选功能 (价值<60):');
    sortedAssessments
      .filter(([_, assessment]) => assessment.score < 60)
      .forEach(([name, assessment]) => {
        console.log(`❌ ${name}: ${assessment.score}分 - ${assessment.reason}`);
      });

    // 统计信息
    const critical = sortedAssessments.filter(([_, a]) => a.value === 'CRITICAL').length;
    const high = sortedAssessments.filter(([_, a]) => a.value === 'HIGH').length;
    const medium = sortedAssessments.filter(([_, a]) => a.value === 'MEDIUM').length;
    const low = sortedAssessments.filter(([_, a]) => a.value === 'LOW').length;

    console.log('\n📈 统计摘要:');
    console.log(`  🔴 关键功能: ${critical}个`);
    console.log(`  🟠 重要功能: ${high}个`);
    console.log(`  🟡 一般功能: ${medium}个`);
    console.log(`  🔵 可选功能: ${low}个`);
    console.log(`  📊 总计: ${this.assessment.size}个功能模块`);
  }

  generateRefactorRecommendations() {
    console.log('\n🎯 重构建议');

    const recommendations = {
      retain: [],      // 必须保留
      optimize: [],    // 需要优化
      rename: [],      // 重命名
      remove: []       // 可以移除
    };

    for (const [name, assessment] of this.assessment) {
      if (assessment.value === 'CRITICAL') {
        recommendations.retain.push({ name, ...assessment });
      } else if (assessment.value === 'HIGH') {
        recommendations.retain.push({ name, ...assessment });
      } else if (assessment.category === 'UTIL_INSPIRED') {
        recommendations.rename.push({ name, ...assessment });
      } else if (assessment.value === 'LOW') {
        recommendations.remove.push({ name, ...assessment });
      } else {
        recommendations.optimize.push({ name, ...assessment });
      }
    }

    console.log('\n✅ 必须保留的功能:');
    recommendations.retain.forEach(item => {
      console.log(`  • ${item.name} (${item.lines}行) - ${item.reason}`);
    });

    console.log('\n🔄 需要优化的功能:');
    recommendations.optimize.forEach(item => {
      console.log(`  • ${item.name} - ${item.recommendation}`);
    });

    console.log('\n📝 需要重命名的功能:');
    recommendations.rename.forEach(item => {
      console.log(`  • ${item.name} → ${item.name.replace('Inspired', '')}`);
    });

    console.log('\n❌ 可以移除的功能:');
    recommendations.remove.forEach(item => {
      console.log(`  • ${item.name} - ${item.recommendation}`);
    });

    // 保存详细建议
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFeatures: this.assessment.size,
        retainCount: recommendations.retain.length,
        optimizeCount: recommendations.optimize.length,
        renameCount: recommendations.rename.length,
        removeCount: recommendations.remove.length
      },
      recommendations,
      detailedAssessments: Object.fromEntries(this.assessment)
    };

    fs.writeFileSync('feature-value-assessment.json', JSON.stringify(report, null, 2));
    console.log('\n💾 详细评估已保存至: feature-value-assessment.json');
  }
}

// 运行评估
new FeatureValueAnalyzer().analyze().catch(console.error);
