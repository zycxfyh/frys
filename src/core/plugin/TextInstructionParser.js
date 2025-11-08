/**
 * 📝 frys 文本指令解析器
 *
 * 解析VCPToolBox风格的工具调用指令：
 * <<<[TOOL_REQUEST]>>>tool_name:「始」ToolName「末」,param:「始」value「末」<<<[END_TOOL_REQUEST]>>
 */

import { logger } from '../../shared/utils/logger.js';

export class TextInstructionParser {
  constructor() {
    // 指令块匹配正则
    this.toolRequestRegex = /<<<\[TOOL_REQUEST\]>>>(.*?)<<<\[END_TOOL_REQUEST\]>>>/gs;

    // 参数解析正则：key:「始」value「末」
    this.paramRegex = /(\w+)：「始」([^「]+)「末」/g;

    // 备用格式支持
    this.backupParamRegex = /(\w+):「(.*?)」/g;
  }

  /**
   * 解析文本中的所有工具调用指令
   */
  parseInstructions(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const instructions = [];
    let match;

    // 重置正则的lastIndex
    this.toolRequestRegex.lastIndex = 0;

    while ((match = this.toolRequestRegex.exec(text)) !== null) {
      try {
        const block = match[1];
        const instruction = this.parseInstructionBlock(block);

        if (instruction) {
          instructions.push(instruction);
        }
      } catch (error) {
        logger.warn('Failed to parse instruction block:', error.message);
      }
    }

    return instructions;
  }

  /**
   * 解析单个指令块
   */
  parseInstructionBlock(block) {
    if (!block || typeof block !== 'string') {
      return null;
    }

    // 解析参数
    const parameters = this.parseParameters(block);

    if (!parameters.tool_name) {
      logger.warn('Instruction block missing tool_name parameter');
      return null;
    }

    // 提取工具名称
    const toolName = parameters.tool_name;
    delete parameters.tool_name;

    return {
      toolName,
      parameters,
      rawBlock: block,
      parsedAt: new Date()
    };
  }

  /**
   * 解析参数
   */
  parseParameters(block) {
    const parameters = {};

    // 首先尝试标准格式：key:「始」value「末」
    this.paramRegex.lastIndex = 0;
    let paramMatch;

    while ((paramMatch = this.paramRegex.exec(block)) !== null) {
      const [, key, value] = paramMatch;
      parameters[key] = this.parseValue(value);
    }

    // 如果没有找到参数，尝试备用格式
    if (Object.keys(parameters).length === 0) {
      this.backupParamRegex.lastIndex = 0;

      while ((paramMatch = this.backupParamRegex.exec(block)) !== null) {
        const [, key, value] = paramMatch;
        parameters[key] = this.parseValue(value);
      }
    }

    return parameters;
  }

  /**
   * 解析参数值
   * 支持字符串、数字、布尔值、JSON对象等
   */
  parseValue(value) {
    if (!value) return '';

    // 尝试解析为数字
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }

    // 尝试解析为布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // 尝试解析为JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // 解析失败，当作字符串处理
      }
    }

    // 默认当作字符串
    return value;
  }

  /**
   * 验证指令格式
   */
  validateInstruction(instruction) {
    if (!instruction || typeof instruction !== 'object') {
      return { valid: false, error: 'Invalid instruction object' };
    }

    if (!instruction.toolName || typeof instruction.toolName !== 'string') {
      return { valid: false, error: 'Missing or invalid tool name' };
    }

    if (!instruction.parameters || typeof instruction.parameters !== 'object') {
      return { valid: false, error: 'Missing or invalid parameters' };
    }

    return { valid: true };
  }

  /**
   * 格式化指令为文本
   */
  formatInstruction(toolName, parameters) {
    const params = [];

    // 添加工具名称
    params.push(`tool_name:「始」${toolName}「末」`);

    // 添加其他参数
    for (const [key, value] of Object.entries(parameters)) {
      const formattedValue = this.formatValue(value);
      params.push(`${key}:「始」${formattedValue}「末」`);
    }

    const paramString = params.join(',');
    return `<<<[TOOL_REQUEST]>>>${paramString}<<<[END_TOOL_REQUEST]>>>`;
  }

  /**
   * 格式化参数值
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }

    return String(value);
  }

  /**
   * 移除已处理的指令
   */
  removeProcessedInstructions(text, processedInstructions) {
    let result = text;

    for (const instruction of processedInstructions) {
      if (instruction.rawBlock) {
        const fullBlock = `<<<[TOOL_REQUEST]>>>${instruction.rawBlock}<<<[END_TOOL_REQUEST]>>>`;
        result = result.replace(fullBlock, '');
      }
    }

    return result.trim();
  }

  /**
   * 获取支持的工具列表
   */
  getSupportedTools(availablePlugins) {
    const tools = {};

    for (const plugin of availablePlugins) {
      if (plugin.capabilities && plugin.capabilities.invocationCommands) {
        for (const command of plugin.capabilities.invocationCommands) {
          tools[command.commandIdentifier] = {
            name: command.commandIdentifier,
            description: command.description,
            plugin: plugin.name,
            parameters: this.extractParametersFromDescription(command.description)
          };
        }
      }
    }

    return tools;
  }

  /**
   * 从描述中提取参数信息
   */
  extractParametersFromDescription(description) {
    // 简单的参数提取逻辑
    const params = [];

    // 匹配类似 "1. param_name:「始」[description]「末」" 的格式
    const paramRegex = /(\d+)\.\s*(\w+)：「始」([^「]+)「末」/g;
    let match;

    while ((match = paramRegex.exec(description)) !== null) {
      params.push({
        name: match[2],
        description: match[3],
        required: !match[3].includes('可选') && !match[3].includes('optional')
      });
    }

    return params;
  }

  /**
   * 生成工具调用提示
   */
  generateToolPrompt(availablePlugins) {
    const tools = this.getSupportedTools(availablePlugins);

    if (Object.keys(tools).length === 0) {
      return '目前没有可用的工具。';
    }

    let prompt = '你可以调用以下工具：\n\n';

    for (const [toolName, toolInfo] of Object.entries(tools)) {
      prompt += `## ${toolName}\n`;
      prompt += `${toolInfo.description}\n\n`;

      if (toolInfo.parameters && toolInfo.parameters.length > 0) {
        prompt += '**参数：**\n';
        for (const param of toolInfo.parameters) {
          prompt += `- ${param.name}: ${param.description}`;
          if (param.required) {
            prompt += ' (必需)';
          }
          prompt += '\n';
        }
        prompt += '\n';
      }

      // 添加调用示例
      prompt += '**调用格式：**\n';
      prompt += `<<<[TOOL_REQUEST]>>>tool_name:「始」${toolName}「末」`;

      if (toolInfo.parameters && toolInfo.parameters.length > 0) {
        for (const param of toolInfo.parameters) {
          if (param.required) {
            prompt += `,${param.name}:「始」[值]「末」`;
          }
        }
      }

      prompt += `<<<[END_TOOL_REQUEST]>>>\n\n`;
    }

    return prompt;
  }

  /**
   * 清理和规范化文本
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      .replace(/\r\n/g, '\n')  // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n'); // 最多两个连续换行
  }

  /**
   * 获取解析统计
   */
  getParseStats() {
    return {
      supportedFormats: [
        '<<<[TOOL_REQUEST]>>>tool_name:「始」ToolName「末」,param:「始」value「末」<<<[END_TOOL_REQUEST]>>>',
        '<<<[TOOL_REQUEST]>>>tool_name:「ToolName」,param:「value」<<<[END_TOOL_REQUEST]>>>'
      ],
      parameterFormats: [
        'key:「始」value「末」',
        'key:「value」'
      ],
      valueTypes: [
        'string',
        'number',
        'boolean',
        'json_object',
        'json_array'
      ]
    };
  }
}

export default TextInstructionParser;
