import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 执行终端命令
 * @param {string|object} command - 命令字符串或包含命令和参数的对象
 * @param {object} options - 执行选项
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error?: Error}>}
 */
export async function run_terminal_cmd(command, options = {}) {
  try {
    let cmdString;
    const execOptions = { ...options };

    if (typeof command === 'string') {
      cmdString = command;
    } else if (typeof command === 'object' && command.command) {
      cmdString = command.command;
      if (command.args && Array.isArray(command.args)) {
        cmdString += ` ${command.args.join(' ')}`;
      }
      if (command.cwd) {
        execOptions.cwd = command.cwd;
      }
      if (command.env) {
        execOptions.env = { ...process.env, ...command.env };
      }
    } else {
      throw new Error('Invalid command format');
    }

    const { stdout, stderr } = await execAsync(cmdString, execOptions);

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error.stderr || error.message,
      error,
    };
  }
}
