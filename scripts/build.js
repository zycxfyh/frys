#!/usr/bin/env node

/**
 * 简化的构建脚本
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🏗️ 构建 frys...');

  try {
    // 读取主入口文件
    const entryPath = join(__dirname, '../src/index.js');
    const entryContent = await readFile(entryPath, 'utf8');

    // 简单打包：移除import并内联核心代码
    let bundled = entryContent;

    // 移除ES模块导入（简化处理）
    bundled = bundled.replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?\s*/g, '');
    bundled = bundled.replace(/export\s+.*?\s*;?\s*/g, '');

    // 添加简单的包信息
    const header = `/**
 * frys - 轻量级工作流编排引擎
 * 构建时间: ${new Date().toISOString()}
 * 版本: 1.0.0
 */

`;

    bundled = header + bundled;

    // 确保dist目录存在
    await mkdir(join(__dirname, '../dist'), { recursive: true });

    // 写入打包文件
    const outputPath = join(__dirname, '../dist/frys.js');
    await writeFile(outputPath, bundled);

    console.log('✅ 构建完成:', outputPath);

    // 复制package.json用于发布
    const pkgPath = join(__dirname, '../package.json');
    const pkgContent = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);

    // 修改为构建版本
    pkg.main = 'frys.js';
    pkg.scripts = {
      start: 'node frys.js --server',
    };

    await writeFile(
      join(__dirname, '../dist/package.json'),
      JSON.stringify(pkg, null, 2)
    );

    console.log('📦 包配置已生成');

  } catch (error) {
    console.error('❌ 构建失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}

export { build };
