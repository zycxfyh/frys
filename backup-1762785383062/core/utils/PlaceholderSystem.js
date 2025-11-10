/**
 * 🔧 VCP工具占位符系统
 *
 * 借鉴VCPToolBox的动态变量注入理念，实现：
 * - {{variable}} 语法支持：动态变量替换
 * - 表达式求值：支持复杂计算和条件判断
 * - 作用域管理：变量作用域和上下文处理
 * - 类型安全：变量类型验证和转换
 * - 循环引用检测：防止无限递归
 * - 性能优化：变量缓存和表达式编译
 */

import { logger } from '../../shared/utils/logger.js';

export class PlaceholderSystem {
  constructor(options = {}) {
    this.options = this._initializeOptions(options);
    this.variableCache = new Map();
    this.expressionCache = new Map();
    this.builtInFunctions = this._initializeBuiltInFunctions();
    this.functions = {
      ...this.builtInFunctions,
      ...this.options.customFunctions,
    };
    this._logInitialization();
  }

  _initializeOptions(options) {
    return {
      maxDepth: options.maxDepth || 10,
      enableCaching: options.enableCaching !== false,
      strictMode: options.strictMode || false,
      customFunctions: options.customFunctions || {},
      ...options,
    };
  }

  _initializeBuiltInFunctions() {
    return {
      // 数学函数
      ...this._getMathFunctions(),
      // 字符串函数
      ...this._getStringFunctions(),
      // 数组函数
      ...this._getArrayFunctions(),
      // 逻辑函数
      ...this._getLogicFunctions(),
      // 日期时间函数
      ...this._getDateFunctions(),
      // 工具函数
      ...this._getUtilityFunctions(),
    };
  }

  _getMathFunctions() {
    return {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      max: Math.max,
      min: Math.min,
      random: Math.random,
    };
  }

  _getStringFunctions() {
    return {
      uppercase: (str) => String(str).toUpperCase(),
      lowercase: (str) => String(str).toLowerCase(),
      capitalize: (str) =>
        String(str).charAt(0).toUpperCase() +
        String(str).slice(1).toLowerCase(),
      trim: (str) => String(str).trim(),
      length: (str) => String(str).length,
      substring: (str, start, end) => String(str).substring(start, end),
      replace: (str, search, replace) =>
        String(str).replace(new RegExp(search, 'g'), replace),
    };
  }

  _getArrayFunctions() {
    return {
      join: (arr, separator = ',') =>
        Array.isArray(arr) ? arr.join(separator) : arr,
      split: (str, separator = ',') => String(str).split(separator),
      includes: (arr, item) =>
        Array.isArray(arr) ? arr.includes(item) : String(arr).includes(item),
      filter: (arr, condition) => {
        if (!Array.isArray(arr) || typeof condition !== 'function') {
          return arr;
        }
        return arr.filter(condition);
      },
      map: (arr, mapper) => {
        if (!Array.isArray(arr) || typeof mapper !== 'function') {
          return arr;
        }
        return arr.map(mapper);
      },
      reduce: (arr, reducer, initial) => {
        if (!Array.isArray(arr) || typeof reducer !== 'function') {
          return arr;
        }
        return arr.reduce(reducer, initial);
      },
    };
  }

  _getLogicFunctions() {
    return {
      equals: (a, b) => a === b,
      notequals: (a, b) => a !== b,
      gt: (a, b) => a > b,
      gte: (a, b) => a >= b,
      lt: (a, b) => a < b,
      lte: (a, b) => a <= b,
      and: (...args) => args.every(Boolean),
      or: (...args) => args.some(Boolean),
      not: (value) => !value,
    };
  }

  _getDateFunctions() {
    return {
      now: () => new Date(),
      timestamp: () => Date.now(),
      formatdate: this._formatDate.bind(this),
    };
  }

  _formatDate(date, format = 'YYYY-MM-DD') {
    const d = this._parseDate(date);
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }

    const tokens = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0'),
    };

    return Object.entries(tokens).reduce(
      (result, [token, value]) => result.replace(token, value),
      format,
    );
  }

  _parseDate(date) {
    if (date instanceof Date) {
      return date;
    }
    if (typeof date === 'string' || typeof date === 'number') {
      return new Date(date);
    }
    return new Date();
  }

  _getUtilityFunctions() {
    return {
      isEmpty: (value) => value === null || value === undefined || value === '',
      isArray: Array.isArray,
      isObject: (value) =>
        typeof value === 'object' && value !== null && !Array.isArray(value),
      typeOf: (value) => typeof value,
      toString: (value) => String(value),
      toNumber: (value) => Number(value),
      toBoolean: (value) => Boolean(value),
    };
  }

  _logInitialization() {
    logger.info('PlaceholderSystem initialized', {
      maxDepth: this.options.maxDepth,
      enableCaching: this.options.enableCaching,
      strictMode: this.options.strictMode,
    });
  }

  /**
   * 处理字符串中的占位符
   */
  processString(input, context = {}, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }

    const opts = { ...this.options, ...options };
    const cachedResult = this._getCachedResult(input, context);
    if (cachedResult !== null) {
      return cachedResult;
    }

    try {
      const result = this._processWithDepthLimit(input, context, opts);
      this._validateResult(result, opts);
      this._cacheResult(input, context, result);
      return result;
    } catch (error) {
      return this._handleProcessingError(error, input, opts);
    }
  }

  _getCachedResult(input, context) {
    if (!this.options.enableCaching) {
      return null;
    }
    const cacheKey = this.generateCacheKey(input, context);
    return this.variableCache.has(cacheKey)
      ? this.variableCache.get(cacheKey)
      : null;
  }

  _processWithDepthLimit(input, context, opts) {
    let result = input;
    let depth = 0;

    while (this.containsPlaceholders(result) && depth < opts.maxDepth) {
      result = this.processSinglePass(result, context, opts);
      depth++;
    }

    if (depth >= opts.maxDepth) {
      this._handleMaxDepthReached(input, depth, opts);
    }

    return result;
  }

  _handleMaxDepthReached(input, depth, opts) {
    logger.warn('Maximum placeholder resolution depth reached', {
      input,
      depth,
    });
    if (opts.strictMode) {
      throw new Error(
        `Maximum placeholder resolution depth (${opts.maxDepth}) exceeded`,
      );
    }
  }

  _validateResult(result, opts) {
    if (opts.strictMode && this.containsPlaceholders(result)) {
      const unresolved = this.findUnresolvedPlaceholders(result);
      throw new Error(
        `Unresolved placeholders found: ${unresolved.join(', ')}`,
      );
    }
  }

  _cacheResult(input, context, result) {
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(input, context);
      this.variableCache.set(cacheKey, result);
    }
  }

  _handleProcessingError(error, input, opts) {
    logger.error('Placeholder processing failed', {
      input,
      error: error.message,
    });
    if (opts.strictMode) {
      throw error;
    }
    return input;
  }

  /**
   * 处理对象中的占位符
   */
  processObject(obj, context = {}, options = {}) {
    if (obj === null || typeof obj !== 'object') {
      return this.processString(obj, context, options);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processObject(item, context, options));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.processObject(value, context, options);
    }

    return result;
  }

  /**
   * 单次处理占位符
   */
  processSinglePass(input, context, options) {
    return input.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const value = this.evaluateExpression(
          expression.trim(),
          context,
          options,
        );
        return String(value);
      } catch (error) {
        logger.warn('Expression evaluation failed', {
          expression,
          error: error.message,
        });
        // 在非严格模式下保留原始占位符，在严格模式下抛出错误
        if (options.strictMode) {
          throw error;
        }
        return match; // 返回原始占位符
      }
    });
  }

  /**
   * 求值表达式
   */
  evaluateExpression(expression, context, options) {
    // 检查循环引用
    if (this.hasCircularReference(expression, context)) {
      throw new Error(
        `Circular reference detected in expression: ${expression}`,
      );
    }

    // 尝试从缓存获取
    const cacheKey = `expr:${expression}`;
    if (this.options.enableCaching && this.expressionCache.has(cacheKey)) {
      return this.expressionCache.get(cacheKey);
    }

    try {
      let result;

      // 先检查条件表达式（优先级高于函数调用）
      if (expression.includes('?') && expression.includes(':')) {
        result = this.evaluateConditional(expression, context, options);
      }
      // 处理函数调用
      else if (expression.includes('(') && expression.includes(')')) {
        result = this.evaluateFunctionCall(expression, context, options);
      }
      // 处理简单变量
      else {
        result = this.resolveVariable(expression, context, options);
      }

      // 缓存结果
      if (this.options.enableCaching) {
        this.expressionCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.error('Expression evaluation error', {
        expression,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 求值函数调用
   */
  evaluateFunctionCall(expression, context, options) {
    const funcMatch = expression.match(/^(\w+)\((.*)\)$/);
    if (!funcMatch) {
      throw new Error(`Invalid function call syntax: ${expression}`);
    }

    const [, funcName, argsStr] = funcMatch;
    const func = this.functions[funcName];

    if (!func) {
      throw new Error(`Unknown function: ${funcName}`);
    }

    // 解析参数
    const args = this.parseArguments(argsStr, context, options);

    try {
      return func(...args);
    } catch (error) {
      throw new Error(
        `Function ${funcName} execution failed: ${error.message}`,
      );
    }
  }

  /**
   * 求值条件表达式
   */
  evaluateConditional(expression, context, options) {
    const parts = expression.split('?');
    if (parts.length !== 2) {
      throw new Error(`Invalid conditional syntax: ${expression}`);
    }

    const condition = parts[0].trim();
    const branches = parts[1].split(':');

    if (branches.length !== 2) {
      throw new Error(`Invalid conditional branches: ${expression}`);
    }

    // 递归求值条件表达式，支持嵌套函数调用
    const conditionValue = this.evaluateExpression(condition, context, options);
    const trueBranch = branches[0].trim();
    const falseBranch = branches[1].trim();

    return conditionValue
      ? this.evaluateExpression(trueBranch, context, options)
      : this.evaluateExpression(falseBranch, context, options);
  }

  /**
   * 解析参数
   */
  parseArguments(argsStr, context, options) {
    if (!argsStr.trim()) {
      return [];
    }

    // 简单的参数解析（不支持嵌套函数调用）
    const args = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    // 求值每个参数
    return args.map((arg) =>
      this.evaluateSimpleExpression(arg, context, options),
    );
  }

  /**
   * 求值简单表达式
   */
  evaluateSimpleExpression(expression, context, options) {
    if (this._isStringLiteral(expression)) {
      return expression.slice(1, -1);
    }

    if (this._isNumberLiteral(expression)) {
      return parseFloat(expression);
    }

    const literalValue = this._getBooleanOrNullLiteral(expression);
    if (literalValue !== undefined) {
      return literalValue;
    }

    if (this._isComparisonExpression(expression)) {
      return this.evaluateComparison(expression, context, options);
    }

    return this.resolveVariable(expression, context, options);
  }

  _isStringLiteral(expression) {
    return (
      (expression.startsWith('"') && expression.endsWith('"')) ||
      (expression.startsWith("'") && expression.endsWith("'"))
    );
  }

  _isNumberLiteral(expression) {
    return /^-?\d+(\.\d+)?$/.test(expression);
  }

  _getBooleanOrNullLiteral(expression) {
    const literals = {
      true: true,
      false: false,
      null: null,
      undefined,
    };
    return literals[expression];
  }

  _isComparisonExpression(expression) {
    const operators = [
      ' >= ',
      ' <= ',
      ' > ',
      ' < ',
      ' === ',
      ' !== ',
      ' == ',
      ' != ',
    ];
    return operators.some((op) => expression.includes(op));
  }

  /**
   * 求值比较表达式
   */
  evaluateComparison(expression, context, options) {
    const operators = ['>=', '<=', '>', '<', '===', '!==', '==', '!='];

    for (const op of operators) {
      const result = this._tryEvaluateWithOperator(
        expression,
        op,
        context,
        options,
      );
      if (result !== null) {
        return result;
      }
    }

    throw new Error(`Invalid comparison expression: ${expression}`);
  }

  _tryEvaluateWithOperator(expression, operator, context, options) {
    const separator = ` ${operator} `;
    if (!expression.includes(separator)) {
      return null;
    }

    const parts = expression.split(separator);
    if (parts.length !== 2) {
      return null;
    }

    const left = this.evaluateSimpleExpression(
      parts[0].trim(),
      context,
      options,
    );
    const right = this.evaluateSimpleExpression(
      parts[1].trim(),
      context,
      options,
    );

    return this._applyComparisonOperator(operator, left, right);
  }

  _applyComparisonOperator(operator, left, right) {
    const operations = {
      '>=': () => left >= right,
      '<=': () => left <= right,
      '>': () => left > right,
      '<': () => left < right,
      '===': () => left === right,
      '!==': () => left !== right,
      '==': () => left === right,
      '!=': () => left !== right,
    };

    return operations[operator]();
  }

  /**
   * 解析变量
   */
  resolveVariable(variablePath, context, options) {
    // 支持点号路径访问
    const path = variablePath.split('.');
    let current = context;

    for (const segment of path) {
      if (current === null || current === undefined) {
        if (options.strictMode) {
          throw new Error(`Cannot access property '${segment}' of ${current}`);
        }
        return undefined;
      }

      // 支持数组索引
      if (Array.isArray(current) && /^\d+$/.test(segment)) {
        current = current[parseInt(segment)];
      } else {
        current = current[segment];
      }
    }

    // 在严格模式下，如果变量未定义，抛出错误
    if (options.strictMode && current === undefined) {
      throw new Error(`Undefined variable: ${variablePath}`);
    }

    return current;
  }

  /**
   * 检查是否包含占位符
   */
  containsPlaceholders(str) {
    return /\{\{[^}]+\}\}/.test(str);
  }

  /**
   * 查找未解析的占位符
   */
  findUnresolvedPlaceholders(str) {
    const matches = str.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map((match) => match.slice(2, -2).trim()) : [];
  }

  /**
   * 检查循环引用
   */
  hasCircularReference(expression, context, visited = new Set()) {
    if (visited.has(expression)) {
      return true;
    }

    visited.add(expression);

    try {
      // 简单的循环引用检测
      const variables = this.extractVariables(expression);
      for (const variable of variables) {
        if (this.containsPlaceholders(String(context[variable] || ''))) {
          if (
            this.hasCircularReference(
              context[variable],
              context,
              new Set(visited),
            )
          ) {
            return true;
          }
        }
      }
      return false;
    } finally {
      visited.delete(expression);
    }
  }

  /**
   * 提取表达式中的变量
   */
  extractVariables(expression) {
    const variables = new Set();

    // 简单的变量提取（不完整，但对循环引用检测足够）
    const varMatch = expression.match(
      /\b[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*\b/g,
    );
    if (varMatch) {
      varMatch.forEach((match) => {
        if (!this.functions[match.split('.')[0]]) {
          variables.add(match.split('.')[0]);
        }
      });
    }

    return Array.from(variables);
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(input, context) {
    // 简单的缓存键生成（生产环境应使用更复杂的哈希）
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    return `${input}:${contextStr}`;
  }

  /**
   * 注册自定义函数
   */
  registerFunction(name, func) {
    if (typeof func !== 'function') {
      throw new Error(`Function ${name} must be a function`);
    }
    this.functions[name] = func;
    logger.info('Custom function registered', { name });
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.variableCache.clear();
    this.expressionCache.clear();
    logger.info('Placeholder cache cleared');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      cacheSize: {
        variables: this.variableCache.size,
        expressions: this.expressionCache.size,
      },
      functions: Object.keys(this.functions).length,
      options: this.options,
    };
  }
}

// 导出单例实例
export const placeholderSystem = new PlaceholderSystem();
export default PlaceholderSystem;
