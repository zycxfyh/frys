/**
 * 简单的VCP系统测试
 * 用于验证基本功能
 */

import { describe, it, expect } from 'vitest';
import { AgentSystem } from '../../src/core/AgentSystem.js';

describe('简单VCP系统测试', () => {
    it('应该能够创建AgentSystem实例', async () => {
        const agentSystem = new AgentSystem({
            maxConcurrentAgents: 5,
            defaultTimeout: 30000
        });

        expect(agentSystem).toBeDefined();
        expect(typeof agentSystem.initialize).toBe('function');
        expect(typeof agentSystem.shutdown).toBe('function');
    });

    it('应该能够初始化和关闭AgentSystem', async () => {
        const agentSystem = new AgentSystem();

        await expect(agentSystem.initialize()).resolves.not.toThrow();
        await expect(agentSystem.shutdown()).resolves.not.toThrow();
    });
});
