#!/usr/bin/env node

/**
 * 计算器工具
 * 执行数学计算表达式
 */

const math = require('mathjs');

function safeEvaluate(expression) {
  try {
    // 创建安全的数学上下文
    const scope = {
      pi: Math.PI,
      e: Math.E,
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      log: Math.log10,
      ln: Math.log,
      exp: Math.exp,
      abs: Math.abs,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      pow: Math.pow,
    };

    // 使用mathjs进行安全计算
    const result = math.evaluate(expression, scope);

    // 确保结果是数字
    const numResult = Number(result);
    if (isNaN(numResult)) {
      throw new Error('计算结果不是有效数字');
    }

    return numResult;
  } catch (error) {
    throw new Error(`数学表达式错误：${error.message}`);
  }
}

function formatResult(result, precision = 2) {
  if (Number.isInteger(result)) {
    return result.toString();
  }

  return result.toFixed(precision);
}

function calculate(expression, precision = 2) {
  try {
    const result = safeEvaluate(expression);
    const formattedResult = formatResult(result, precision);

    return `计算结果：${expression} = ${formattedResult}`;
  } catch (error) {
    return `计算失败：${error.message}`;
  }
}

function main() {
  let input = '';

  process.stdin.on('data', (chunk) => {
    input += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const params = JSON.parse(input.trim());

      if (!params.expression) {
        const errorResult = {
          status: 'error',
          error: '缺少必需参数：expression',
        };
        console.log(JSON.stringify(errorResult));
        process.exit(1);
      }

      const result = calculate(params.expression, params.precision);

      const successResult = {
        status: 'success',
        result: result,
        expression: params.expression,
        precision: params.precision || 2,
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

  // 设置超时
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

module.exports = { calculate, safeEvaluate, formatResult };
