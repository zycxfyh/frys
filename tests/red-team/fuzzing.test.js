import {
  createDetailedErrorReporter,
  createStrictTestCleanup,
  setupStrictTestEnvironment,
  strictAssert,
  withTimeout,
} from '../test-helpers.js';

/**
 * 模糊测试
 * 使用随机和异常输入测试系统鲁棒性
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HttpClient from '../../src/core/HttpClient.js';
import JWTAuth from '../../src/core/JWTAuth.js';
import SQLiteDatabase from '../../src/core/SQLiteDatabase.js';
import RedTeamFramework, { AttackVectors } from './red-team-framework.js';

describe('模糊测试', () => {
  let redTeam;
  let auth;
  let http;
  let db;

  beforeEach(() => {
    redTeam = new RedTeamFramework();
    auth = new JWTAuth();
    http = new HttpClient();
    db = new SQLiteDatabase();

    // 设置测试环境
    auth.setSecret('test-key', 'test-secret');

    // 注册模糊测试向量
    redTeam.registerAttack(AttackVectors.FUZZ_ATTACK, async (payload) => {
      try {
        const result = await fuzzTarget(payload.target, payload.input);
        const isCrashed = checkForCrash(result);

        return {
          success: isCrashed,
          blocked: !isCrashed,
          details: {
            target: payload.target,
            input: payload.input,
            result: result,
            crashed: isCrashed,
            fuzzType: payload.fuzzType,
          },
        };
      } catch (error) {
        return {
          success: true, // 异常被认为是崩溃
          blocked: false,
          details: {
            target: payload.target,
            input: payload.input,
            error: error.message,
            crashed: true,
            fuzzType: payload.fuzzType,
          },
        };
      }
    });
  });

  afterEach(() => {
    redTeam.cleanup();
  });

  // 模糊测试目标函数
  async function fuzzTarget(target, input) {
    switch (target) {
      case 'auth':
        return await fuzzAuth(input);
      case 'http':
        return await fuzzHttp(input);
      case 'database':
        return await fuzzDatabase(input);
      case 'json':
        return fuzzJson(input);
      case 'xml':
        return fuzzXml(input);
      case 'regex':
        return fuzzRegex(input);
      default:
        throw new Error(`未知的模糊测试目标: ${target}`);
    }
  }

  // 检查是否崩溃
  function checkForCrash(result) {
    if (result.handled) return false; // 被正常处理的输入不算崩溃
    if (result.error) return true;
    if (result.exception) return true;
    if (result.timeout) return true;
    if (result.memoryLeak) return true;
    return false;
  }

  // 认证系统模糊测试
  async function fuzzAuth(input) {
    try {
      // 空输入应该被正常处理
      if (input === null || input === undefined || input === '') {
        return { success: true, data: null, handled: true };
      }

      // 尝试使用模糊输入生成令牌
      const token = auth.generateToken(input, 'test-key');
      if (token === null) {
        // 正常处理了无效输入
        return { success: true, data: null, handled: true };
      }

      // 尝试验证模糊令牌
      const verified = await auth.verifyToken(token, 'test-key');
      return { success: true, data: verified };
    } catch (error) {
      return { error: error.message, crashed: true };
    }
  }

  // HTTP客户端模糊测试
  async function fuzzHttp(input) {
    try {
      // 模拟HTTP请求的模糊输入
      const config = {
        url: input.url || 'http://test.com',
        method: input.method || 'GET',
        headers: input.headers || {},
        data: input.data,
        timeout: input.timeout || 5000,
      };

      // 这里只是模拟，不实际发送请求
      if (input.invalidUrl || input.malformedHeaders) {
        throw new Error('Invalid HTTP request configuration');
      }

      return { success: true, config: config };
    } catch (error) {
      return { error: error.message, crashed: true };
    }
  }

  // 数据库模糊测试
  async function fuzzDatabase(input) {
    try {
      // 模拟数据库查询的模糊输入
      const query = `SELECT * FROM users WHERE id = ${input}`;
      // 这里只是模拟，不实际执行查询
      if (typeof input !== 'number' && typeof input !== 'string') {
        throw new Error('Invalid query parameter type');
      }
      return { success: true, query: query };
    } catch (error) {
      return { error: error.message, crashed: true };
    }
  }

  // JSON解析模糊测试
  function fuzzJson(input) {
    try {
      const parsed = JSON.parse(input);
      return { success: true, parsed: parsed };
    } catch (error) {
      return { success: true, error: error.message, handled: true }; // JSON.parse错误被正常处理
    }
  }

  // XML解析模糊测试
  function fuzzXml(input) {
    try {
      // 简化的XML解析模拟
      if (input.includes('<') && !input.includes('>')) {
        throw new Error('Unclosed XML tag');
      }
      if (input.includes('&') && !input.includes(';')) {
        throw new Error('Unclosed XML entity');
      }
      return { success: true, parsed: input };
    } catch (error) {
      return { error: error.message, crashed: true };
    }
  }

  // 正则表达式模糊测试
  function fuzzRegex(input) {
    try {
      // 尝试编译正则表达式
      new RegExp(input);
      return { success: true, regex: input };
    } catch (error) {
      return { success: true, error: error.message, handled: true }; // 无效正则被正常处理
    }
  }

  describe('边界值模糊测试', () => {
    it('应该处理空字符串输入', async () => {
      const payload = {
        target: 'auth',
        input: '',
        fuzzType: 'empty_string',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false); // 空字符串不应该导致崩溃
      expect(result.blocked).toBe(true);
    });

    it('应该处理null输入', async () => {
      const payload = {
        target: 'auth',
        input: null,
        fuzzType: 'null_input',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('应该处理undefined输入', async () => {
      const payload = {
        target: 'auth',
        input: undefined,
        fuzzType: 'undefined_input',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('应该处理超长字符串', async () => {
      const longString = 'A'.repeat(10000);
      const payload = {
        target: 'auth',
        input: longString,
        fuzzType: 'long_string',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('类型混淆模糊测试', () => {
    const typeConfusionInputs = [
      { input: 0, type: 'number_zero' },
      { input: 1, type: 'number_one' },
      { input: -1, type: 'negative_number' },
      { input: NaN, type: 'not_a_number' },
      { input: Infinity, type: 'infinity' },
      { input: -Infinity, type: 'negative_infinity' },
      { input: true, type: 'boolean_true' },
      { input: false, type: 'boolean_false' },
      { input: [], type: 'empty_array' },
      { input: {}, type: 'empty_object' },
      { input: Symbol('test'), type: 'symbol' },
      { input: () => {}, type: 'function' },
      { input: new Date(), type: 'date_object' },
      { input: /test/, type: 'regex_object' },
      { input: Buffer.from('test'), type: 'buffer' },
    ];

    it.each(typeConfusionInputs)(
      '应该处理 $type 类型输入',
      async ({ input, type }) => {
        const payload = {
          target: 'auth',
          input: input,
          fuzzType: type,
        };

        const result = await redTeam.executeAttack(
          AttackVectors.FUZZ_ATTACK,
          payload,
        );

        expect(result.success).toBe(false);
        expect(result.blocked).toBe(true);
        expect(result.details.fuzzType).toBe(type);
      },
    );
  });

  describe('格式化字符串模糊测试', () => {
    const formatStrings = [
      '%s%s%s%s%s%s%s%s%s%s',
      '%n%n%n%n%n',
      '%x%x%x%x%x',
      '%d%d%d%d%d',
      '%f%f%f%f%f',
      '%p%p%p%p%p',
      '%%',
      '%*s',
      '%.*s',
      '%*.*s',
    ];

    it.each(formatStrings)('应该处理格式化字符串: %s', async (formatStr) => {
      const payload = {
        target: 'auth',
        input: formatStr,
        fuzzType: 'format_string',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('编码模糊测试', () => {
    const encodingInputs = [
      { input: '%00', type: 'null_byte_url' },
      { input: '%0A', type: 'newline_url' },
      { input: '%0D', type: 'carriage_return_url' },
      { input: '\\x00', type: 'null_byte_hex' },
      { input: '\\n', type: 'newline_escape' },
      { input: '\\r', type: 'carriage_return_escape' },
      { input: '\\u0000', type: 'null_unicode' },
      { input: '\\u000A', type: 'newline_unicode' },
      { input: '\u0000', type: 'null_char' },
      { input: '\u000A', type: 'newline_char' },
      { input: '\uFFFF', type: 'max_unicode' },
    ];

    it.each(encodingInputs)(
      '应该处理 $type 编码输入',
      async ({ input, type }) => {
        const payload = {
          target: 'auth',
          input: input,
          fuzzType: type,
        };

        const result = await redTeam.executeAttack(
          AttackVectors.FUZZ_ATTACK,
          payload,
        );

        expect(result.success).toBe(false);
        expect(result.blocked).toBe(true);
      },
    );
  });

  describe('路径遍历模糊测试', () => {
    const pathTraversalInputs = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\sam',
      '/../../../../etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
      '..%5C..%5C..%5Cwindows%5Csystem32%5Cconfig%5Csam',
      '/etc/passwd%00.jpg',
      '../../../etc/passwd%00',
      '/etc/passwd/../../../etc/shadow',
    ];

    it.each(pathTraversalInputs)('应该处理路径遍历: %s', async (path) => {
      const payload = {
        target: 'auth',
        input: path,
        fuzzType: 'path_traversal',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('JSON模糊测试', () => {
    const jsonInputs = [
      '{"valid": "json"}',
      '{"incomplete": "json"',
      '{"nested": {"deep": {"very": "deep"}}}',
      '["array", "of", "strings"]',
      '{"number": 123, "boolean": true, "null": null}',
      '{"unicode": "测试字符串"}',
      '{"escape": "quote: \\"hello\\" and slash: \\\\"}',
      '{"deeply": ' +
        '{"nested": '.repeat(10) +
        '{}'.repeat(10) +
        '}'.repeat(10),
      '{"circular": ', // 无效JSON
      '{"trailing": "comma",}',
      '{"duplicate": "key", "duplicate": "value"}',
      '{"number": 1e1000}', // 极大数字
      '{"negative": -1e1000}', // 极小数字
      'null',
      'true',
      'false',
      '"string"',
      '123',
    ];

    it.each(jsonInputs)('应该处理JSON输入: %s', async (jsonStr) => {
      const payload = {
        target: 'json',
        input: jsonStr,
        fuzzType: 'json_fuzz',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      // JSON解析错误不应该被视为系统崩溃
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('XML模糊测试', () => {
    const xmlInputs = [
      '<valid>XML</valid>',
      '<unclosed>XML',
      '<self-closing />',
      '<?xml version="1.0"?><root><child>content</child></root>',
      '<root><child attribute="value">content</child></root>',
      '<root>&lt;escaped&gt;</root>',
      '<root><![CDATA[unparsed <data>]]></root>',
      '<root><!-- comment --></root>',
      '<root><empty></empty></root>',
      '<root xmlns="http://example.com">namespaced</root>',
      '<root>' +
        '<nested>'.repeat(10) +
        'deep' +
        '</nested>'.repeat(10) +
        '</root>',
      '<root>&invalid-entity;</root>',
      '<root><unclosed-nested></root>',
      '<root><wrong-closing></wrong></root>',
    ];

    it.each(xmlInputs)('应该处理XML输入: %s', async (xmlStr) => {
      const payload = {
        target: 'xml',
        input: xmlStr,
        fuzzType: 'xml_fuzz',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('正则表达式模糊测试', () => {
    const regexInputs = [
      'simple',
      '.*',
      '^start.*end$',
      '[a-zA-Z0-9]+',
      '\\d{3}-\\d{2}-\\d{4}',
      '(a|b|c)*',
      'a{1,1000}', // 可能导致回溯问题
      'a*a*a*a*a*a*a*a*a*a*', // 灾难性回溯
      '[\\w\\W]*', // 匹配任何字符
      '(x+x+)+y', // 指数级回溯
      'a?a?a?a?a?a?a?a?a?a?', // 多个可选匹配
      '(a*)*', // 嵌套量词
      '(a|a)*', // 简单的交替
      '\\b\\w+\\b', // 单词边界
      '(?<=prefix)content', // 后行断言
      'content(?=suffix)', // 先行断言
      '(?:non-capturing)', // 非捕获组
      '(?<named>name)', // 命名组
      '\\1', // 反向引用
      '(?=positive)(?!negative)', // 复杂断言
      '[^\\x00-\\x7F]+', // 非ASCII字符
      '\\u{1F600}', // Unicode转义
      '(?i:case)(?-i:insensitive)', // 内联修饰符
      '(?#comment)pattern', // 注释
      '(?(?=condition)then|else)', // 条件分支
      'a++', // 原子组
      'a*+', // 占有量词
      '(?>atomic)group', // 原子组
      '(a)(b)(c)\\3\\2\\1', // 多个反向引用
      '[\\d\\w\\s]*', // 字符类
      '{1,1000000}', // 极大重复
      '(?:a{1,10}){1,10}', // 嵌套重复
      '(a|b){1,1000}|(c|d){1,1000}', // 交替重复
      '\\b(?:word1|word2|word3)\\b', // 单词列表
      '(?:\\d{1,3}\\.){3}\\d{1,3}', // IP地址模式
      '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}', // 域名模式
      '(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])', // 日期模式
      '(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d', // 时间模式
      '\\$\\d+(?:,\\d{3})*(?:\\.\\d{2})?', // 货币模式
      '(?:\\+?1[-.\\s]?)?\\(?[2-9]\\d{2}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', // 电话号码模式
      '(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\\d{3})\\d{11})', // 信用卡模式
      '(?:ISBN(?:-1[03])?:? )?(?=[-0-9 ]{17}$|[-0-9X ]{13}$|[0-9X]{10}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?(?:[0-9]+[- ]?){2}[0-9X]', // ISBN模式
      '(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*|"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])', // 邮箱模式
    ];

    it.each(regexInputs)('应该处理正则表达式: %s', async (regexStr) => {
      const payload = {
        target: 'regex',
        input: regexStr,
        fuzzType: 'regex_fuzz',
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      // 正则表达式错误不应该被视为系统崩溃
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('随机数据模糊测试', () => {
    // 生成随机测试数据的函数
    function generateRandomData(type, length = 100) {
      switch (type) {
        case 'string':
          return Math.random().toString(36).repeat(length);
        case 'binary':
          return Buffer.from(
            Array.from({ length }, () => Math.floor(Math.random() * 256)),
          );
        case 'unicode':
          return String.fromCharCode(
            ...Array.from({ length }, () => Math.floor(Math.random() * 0xffff)),
          );
        case 'control':
          return String.fromCharCode(
            ...Array.from({ length }, () => Math.floor(Math.random() * 32)),
          );
        case 'mixed': {
          const chars = [];
          for (let i = 0; i < length; i++) {
            const type = Math.floor(Math.random() * 4);
            switch (type) {
              case 0:
                chars.push(
                  String.fromCharCode(Math.floor(Math.random() * 128)),
                );
                break; // ASCII
              case 1:
                chars.push(
                  String.fromCharCode(Math.floor(Math.random() * 0xffff)),
                );
                break; // Unicode
              case 2:
                chars.push(String.fromCharCode(Math.floor(Math.random() * 32)));
                break; // 控制字符
              case 3:
                chars.push(
                  ['<', '>', '"', "'", '&', '%', '\\', '/'][
                    Math.floor(Math.random() * 8)
                  ],
                );
                break; // 特殊字符
            }
          }
          return chars.join('');
        }
        default:
          return Math.random().toString(36);
      }
    }

    const randomTypes = ['string', 'binary', 'unicode', 'control', 'mixed'];

    it.each(randomTypes)('应该处理随机 $s 数据', async (type) => {
      const randomData = generateRandomData(type);
      const payload = {
        target: 'auth',
        input: randomData,
        fuzzType: `random_${type}`,
      };

      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('性能模糊测试', () => {
    it('应该在合理时间内处理模糊输入', async () => {
      const largeInput = 'A'.repeat(100000); // 10万个字符
      const payload = {
        target: 'auth',
        input: largeInput,
        fuzzType: 'performance_fuzz',
      };

      const startTime = performance.now();
      const result = await redTeam.executeAttack(
        AttackVectors.FUZZ_ATTACK,
        payload,
      );
      const endTime = performance.now();

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该处理高频模糊攻击', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const payload = {
          target: 'auth',
          input: `fuzz_input_${i}_${Math.random()}`,
          fuzzType: 'high_frequency',
        };
        promises.push(
          redTeam.executeAttack(AttackVectors.FUZZ_ATTACK, payload),
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      results.forEach((result) => {
        expect(result.success).toBe(false);
        expect(result.blocked).toBe(true);
      });

      expect(endTime - startTime).toBeLessThan(5000); // 100个请求应该在5秒内完成
    });
  });
});
