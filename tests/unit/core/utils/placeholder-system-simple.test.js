import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlaceholderSystem } from '../../../../src/core/utils/PlaceholderSystem.js';

describe('PlaceholderSystem', () => {
  let system;

  beforeEach(() => {
    system = new PlaceholderSystem({
      enableCaching: false,
      strictMode: true,
      maxDepth: 10
    });
  });

  afterEach(() => {
    system = null;
  });

  describe('Variable Substitution', () => {
    it('should replace simple variables', () => {
      const template = 'Hello {{name}}!';
      const context = { name: 'World' };
      const result = system.processString(template, context);
      expect(result).toBe('Hello World!');
    });

    it('should handle nested object properties', () => {
      const template = 'User: {{user.name}} ({{user.age}} years old)';
      const context = {
        user: { name: 'Alice', age: 30 }
      };
      const result = system.processString(template, context);
      expect(result).toBe('User: Alice (30 years old)');
    });

    it('should support array indexing', () => {
      const template = 'First: {{items.0}}, Second: {{items.1}}';
      const context = { items: ['apple', 'banana', 'cherry'] };
      const result = system.processString(template, context);
      expect(result).toBe('First: apple, Second: banana');
    });
  });
});
