#!/usr/bin/env node

/**
 * 测试结果聚合器 - 智能分析和报告生成
 * 功能：
 * - 聚合所有测试结果
 * - 生成统一报告
 * - 提供智能洞察
 * - 支持多种输出格式
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

class TestResultsAggregator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.CI ? 'ci' : 'local',
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF || 'unknown',
      summary: {},
      details: {},
      insights: [],
      recommendations: [],
    };

    this.sources = [
      'test-results/',
      'coverage/',
      'reports/',
      'performance-results.json',
      'security-audit-report.json',
    ];
  }

  async aggregate() {
    console.log('📊 测试结果聚合器启动...');

    try {
      await this.collectResults();
      await this.analyzeResults();
      await this.generateInsights();
      await this.generateRecommendations();
      await this.exportReports();

      this.printSummary();
    } catch (error) {
      console.error('❌ 结果聚合失败:', error);
      process.exit(1);
    }
  }

  async collectResults() {
    console.log('📥 收集测试结果...');

    const allResults = {};

    // 收集单元测试结果
    if (existsSync('test-results/unit-results.json')) {
      allResults.unit = JSON.parse(
        readFileSync('test-results/unit-results.json', 'utf8'),
      );
    }

    // 收集集成测试结果
    if (existsSync('test-results/integration-results.json')) {
      allResults.integration = JSON.parse(
        readFileSync('test-results/integration-results.json', 'utf8'),
      );
    }

    // 收集覆盖率数据
    if (existsSync('coverage/coverage-summary.json')) {
      allResults.coverage = JSON.parse(
        readFileSync('coverage/coverage-summary.json', 'utf8'),
      );
    }

    // 收集性能测试结果
    if (existsSync('performance-results.json')) {
      allResults.performance = JSON.parse(
        readFileSync('performance-results.json', 'utf8'),
      );
    }

    // 收集安全审计结果
    if (existsSync('security-audit-report.json')) {
      allResults.security = JSON.parse(
        readFileSync('security-audit-report.json', 'utf8'),
      );
    }

    // 收集Playwright E2E结果
    if (existsSync('playwright-report/results.json')) {
      allResults.e2e = JSON.parse(
        readFileSync('playwright-report/results.json', 'utf8'),
      );
    }

    this.rawResults = allResults;
    this.results.details = allResults;

    console.log(`📋 收集到 ${Object.keys(allResults).length} 种测试结果`);
    console.log('✅ 结果收集完成\n');
  }

  async analyzeResults() {
    console.log('🔬 分析测试结果...');

    const summary = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: 0,
      performance: {},
      security: { vulnerabilities: 0 },
      duration: 0,
    };

    // 分析单元测试
    if (this.rawResults.unit) {
      const unit = this.rawResults.unit;
      summary.totalTests += unit.numTotalTests || 0;
      summary.passedTests += unit.numPassedTests || 0;
      summary.failedTests += unit.numFailedTests || 0;
    }

    // 分析集成测试
    if (this.rawResults.integration) {
      const integration = this.rawResults.integration;
      summary.totalTests += integration.numTotalTests || 0;
      summary.passedTests += integration.numPassedTests || 0;
      summary.failedTests += integration.numFailedTests || 0;
    }

    // 分析覆盖率
    if (this.rawResults.coverage) {
      summary.coverage = this.rawResults.coverage.total.lines.pct;
    }

    // 分析性能
    if (this.rawResults.performance) {
      summary.performance = {
        avgResponseTime: this.rawResults.performance.avgResponseTime,
        throughput: this.rawResults.performance.throughput,
        p95ResponseTime: this.rawResults.performance.p95ResponseTime,
      };
    }

    // 分析安全
    if (this.rawResults.security) {
      summary.security.vulnerabilities =
        this.rawResults.security.vulnerabilities?.length || 0;
    }

    // 计算通过率
    summary.passRate =
      summary.totalTests > 0
        ? Math.round((summary.passedTests / summary.totalTests) * 100)
        : 0;

    this.results.summary = summary;
    console.log(`📊 总体通过率: ${summary.passRate}%`);
    console.log(`📈 覆盖率: ${summary.coverage}%`);
    console.log('✅ 结果分析完成\n');
  }

  async generateInsights() {
    console.log('💡 生成智能洞察...');

    const insights = [];
    const { summary } = this.results;

    // 通过率洞察
    if (summary.passRate >= 95) {
      insights.push({
        type: 'success',
        title: '🎉 优秀测试通过率',
        description: `测试通过率达到 ${summary.passRate}%，代码质量很高`,
        impact: 'high',
      });
    } else if (summary.passRate >= 80) {
      insights.push({
        type: 'info',
        title: '✅ 良好测试通过率',
        description: `测试通过率 ${summary.passRate}%，符合预期标准`,
        impact: 'medium',
      });
    } else {
      insights.push({
        type: 'warning',
        title: '⚠️ 测试通过率需要改进',
        description: `测试通过率仅 ${summary.passRate}%，建议检查失败的测试`,
        impact: 'high',
      });
    }

    // 覆盖率洞察
    if (summary.coverage >= 90) {
      insights.push({
        type: 'success',
        title: '📈 出色覆盖率',
        description: `代码覆盖率达到 ${summary.coverage}%，测试覆盖非常充分`,
        impact: 'high',
      });
    } else if (summary.coverage >= 80) {
      insights.push({
        type: 'info',
        title: '📊 良好覆盖率',
        description: `代码覆盖率 ${summary.coverage}%，基本满足要求`,
        impact: 'medium',
      });
    } else {
      insights.push({
        type: 'warning',
        title: '📉 覆盖率不足',
        description: `代码覆盖率仅 ${summary.coverage}%，建议增加测试`,
        impact: 'high',
      });
    }

    // 性能洞察
    if (summary.performance.avgResponseTime) {
      if (summary.performance.avgResponseTime < 100) {
        insights.push({
          type: 'success',
          title: '⚡ 优秀性能',
          description: `平均响应时间 ${summary.performance.avgResponseTime}ms，性能表现优秀`,
          impact: 'high',
        });
      } else if (summary.performance.avgResponseTime < 500) {
        insights.push({
          type: 'info',
          title: '✅ 良好性能',
          description: `平均响应时间 ${summary.performance.avgResponseTime}ms，性能表现正常`,
          impact: 'medium',
        });
      } else {
        insights.push({
          type: 'warning',
          title: '🐌 性能需要优化',
          description: `平均响应时间 ${summary.performance.avgResponseTime}ms，建议优化性能`,
          impact: 'high',
        });
      }
    }

    // 安全洞察
    if (summary.security.vulnerabilities > 0) {
      insights.push({
        type: 'error',
        title: '🔒 安全漏洞发现',
        description: `发现 ${summary.security.vulnerabilities} 个安全漏洞，建议立即修复`,
        impact: 'critical',
      });
    } else {
      insights.push({
        type: 'success',
        title: '🛡️ 安全审计通过',
        description: '未发现安全漏洞，代码安全性良好',
        impact: 'high',
      });
    }

    this.results.insights = insights;
    console.log(`💡 生成洞察: ${insights.length} 条`);
    console.log('✅ 洞察生成完成\n');
  }

  async generateRecommendations() {
    console.log('📋 生成改进建议...');

    const recommendations = [];
    const { summary, insights } = this.results;

    // 基于洞察生成建议
    for (const insight of insights) {
      if (insight.type === 'warning' || insight.type === 'error') {
        switch (insight.title) {
          case '⚠️ 测试通过率需要改进':
            recommendations.push({
              category: 'testing',
              priority: 'high',
              action: '修复失败的测试用例',
              description: '分析测试失败原因并修复相关代码',
              effort: 'medium',
              tools: ['Vitest', 'Playwright'],
            });
            break;

          case '📉 覆盖率不足':
            recommendations.push({
              category: 'coverage',
              priority: 'medium',
              action: '增加单元测试覆盖率',
              description: '为未覆盖的代码路径添加测试用例',
              effort: 'medium',
              tools: ['Vitest', 'nyc'],
            });
            break;

          case '🐌 性能需要优化':
            recommendations.push({
              category: 'performance',
              priority: 'medium',
              action: '优化API响应时间',
              description: '分析性能瓶颈并实施优化措施',
              effort: 'high',
              tools: ['Lighthouse', 'WebPageTest'],
            });
            break;

          case '🔒 安全漏洞发现':
            recommendations.push({
              category: 'security',
              priority: 'critical',
              action: '修复安全漏洞',
              description: '更新依赖包或实施安全补丁',
              effort: 'high',
              tools: ['npm audit', 'Snyk'],
            });
            break;
        }
      }
    }

    // 通用建议
    if (summary.passRate >= 95 && summary.coverage >= 90) {
      recommendations.push({
        category: 'maintenance',
        priority: 'low',
        action: '考虑添加集成测试',
        description: '当前测试基础良好，可以考虑添加更多集成测试',
        effort: 'medium',
        tools: ['Testcontainers', 'WireMock'],
      });
    }

    this.results.recommendations = recommendations;
    console.log(`📝 生成建议: ${recommendations.length} 条`);
    console.log('✅ 建议生成完成\n');
  }

  async exportReports() {
    console.log('📤 导出报告...');

    // JSON报告
    writeFileSync(
      'test-results/aggregated-report.json',
      JSON.stringify(this.results, null, 2),
    );

    // Markdown报告
    const markdownReport = this.generateMarkdownReport();
    writeFileSync('test-results/aggregated-report.md', markdownReport);

    // JUnit XML (for CI/CD integration)
    const junitReport = this.generateJUnitReport();
    writeFileSync('test-results/junit-report.xml', junitReport);

    console.log('✅ 报告导出完成\n');
  }

  generateMarkdownReport() {
    const { summary, insights, recommendations } = this.results;

    return `# 🧪 测试聚合报告

**生成时间**: ${new Date().toLocaleString()}
**环境**: ${this.results.environment}
**提交**: ${this.results.commit.substring(0, 7)}

## 📊 总体概览

| 指标 | 值 | 状态 |
|------|-----|------|
| 总测试数 | ${summary.totalTests} | - |
| 通过测试 | ${summary.passedTests} | ✅ |
| 失败测试 | ${summary.failedTests} | ${summary.failedTests > 0 ? '❌' : '✅'} |
| 通过率 | ${summary.passRate}% | ${summary.passRate >= 80 ? '✅' : '⚠️'} |
| 覆盖率 | ${summary.coverage}% | ${summary.coverage >= 80 ? '✅' : '⚠️'} |
| 安全漏洞 | ${summary.security.vulnerabilities} | ${summary.security.vulnerabilities === 0 ? '✅' : '❌'} |

## 💡 智能洞察

${insights
  .map(
    (insight) => `### ${insight.title}

${insight.description}

**影响等级**: ${insight.impact}
`,
  )
  .join('\n')}

## 📋 改进建议

${recommendations
  .map(
    (rec, i) => `${i + 1}. **${rec.action}** (${rec.priority})
   - ${rec.description}
   - **工作量**: ${rec.effort}
   - **工具**: ${rec.tools.join(', ')}
`,
  )
  .join('\n')}

---

*此报告由测试结果聚合器自动生成*
`;
  }

  generateJUnitReport() {
    const { summary } = this.results;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="aggregated-tests" tests="${summary.totalTests}" failures="${summary.failedTests}" time="0">
    <testcase name="unit-tests" time="0">
      ${summary.failedTests > 0 ? '<failure message="Some tests failed"/>' : ''}
    </testcase>
    <testcase name="integration-tests" time="0">
    </testcase>
    <testcase name="e2e-tests" time="0">
    </testcase>
  </testsuite>
</testsuites>`;
  }

  printSummary() {
    const { summary, insights, recommendations } = this.results;

    console.log('🎯 测试聚合总结');
    console.log('='.repeat(60));
    console.log(
      `📊 通过率: ${summary.passRate}% (${summary.passedTests}/${summary.totalTests})`,
    );
    console.log(`📈 覆盖率: ${summary.coverage}%`);
    console.log(`🔒 安全漏洞: ${summary.security.vulnerabilities}`);
    console.log(`💡 洞察数量: ${insights.length}`);
    console.log(`📋 建议数量: ${recommendations.length}`);
    console.log('');
    console.log('📁 生成的报告文件:');
    console.log('   • test-results/aggregated-report.json');
    console.log('   • test-results/aggregated-report.md');
    console.log('   • test-results/junit-report.xml');
    console.log('='.repeat(60));
  }
}

// 运行聚合器
const aggregator = new TestResultsAggregator();
aggregator.aggregate().catch((error) => {
  console.error('❌ 聚合器异常退出:', error);
  process.exit(1);
});
