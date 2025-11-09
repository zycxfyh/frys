#!/usr/bin/env node

/**
 * 文本处理工具
 * 执行各种文本处理操作
 */

function processText(text, operation) {
  if (!text || typeof text !== 'string') {
    throw new Error('输入文本无效');
  }

  switch (operation) {
    case 'stats':
      return getTextStats(text);
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return capitalizeText(text);
    case 'reverse':
      return text.split('').reverse().join('');
    case 'trim':
      return text.trim();
    default:
      throw new Error(`不支持的操作：${operation}`);
  }
}

function getTextStats(text) {
  const chars = text.length;
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const lines = text.split('\n').length;
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0).length;

  return `文本统计：
📊 字符数：${chars}
📝 单词数：${words}
📄 行数：${lines}
💬 句子数：${sentences}`;
}

function capitalizeText(text) {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function main() {
  let input = '';

  process.stdin.on('data', (chunk) => {
    input += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const params = JSON.parse(input.trim());

      if (!params.text) {
        const errorResult = {
          status: 'error',
          error: '缺少必需参数：text',
        };
        console.log(JSON.stringify(errorResult));
        process.exit(1);
      }

      if (!params.operation) {
        const errorResult = {
          status: 'error',
          error: '缺少必需参数：operation',
        };
        console.log(JSON.stringify(errorResult));
        process.exit(1);
      }

      const result = processText(params.text, params.operation);

      const successResult = {
        status: 'success',
        result: result,
        text:
          params.text.substring(0, 100) +
          (params.text.length > 100 ? '...' : ''),
        operation: params.operation,
      };

      console.log(JSON.stringify(successResult));
      process.exit(0);
    } catch (error) {
      const errorResult = {
        status: 'error',
        error: `处理请求失败：${error.message}`,
      };

      console.log(JSON.stringify(errorResult));
      process.exit(1);
    }
  });

  setTimeout(() => {
    const timeoutResult = {
      status: 'error',
      error: '请求处理超时',
    };
    console.log(JSON.stringify(timeoutResult));
    process.exit(1);
  }, 4000);
}

if (require.main === module) {
  main();
}

module.exports = { processText, getTextStats, capitalizeText };
