/**
 * ZustandInspiredState 单元测试
 * 测试状态管理系统的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ZustandInspiredState from '../../../src/core/ZustandInspiredState.js';

describe('ZustandInspiredState', () => {
  let zustand;

  beforeEach(async () => {
    zustand = new ZustandInspiredState();
    await zustand.initialize();
  });

  afterEach(async () => {
    if (zustand) {
      await zustand.destroy();
    }
    zustand = null;
  });

  describe('构造函数', () => {
    it('应该正确初始化实例', () => {
      expect(zustand).toBeInstanceOf(ZustandInspiredState);
      expect(zustand.stores).toBeDefined();
      expect(zustand.subscribers).toBeDefined();
      expect(zustand.middlewares).toBeDefined();
    });

    it('应该有空的初始状态', () => {
      const stats = zustand.getStats();
      expect(stats.stores).toBe(0);
      expect(stats.subscribers).toBe(0);
      expect(stats.middlewares).toBe(0);
    });
  });

  describe('状态存储创建', () => {
    it('应该能创建简单的计数器存储', () => {
      const counterStore = zustand.create((set, get) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 })),
        decrement: () => set(state => ({ count: state.count - 1 })),
        getCount: () => get().count
      }));

      expect(counterStore).toBeDefined();
      expect(counterStore.id).toBeDefined();
      expect(counterStore.state.count).toBe(0);
      expect(typeof counterStore.increment).toBe('function');
      expect(typeof counterStore.decrement).toBe('function');
      expect(typeof counterStore.getCount).toBe('function');
    });

    it('应该能创建复杂的用户存储', () => {
      const userStore = zustand.create((set, get) => ({
        user: null,
        isAuthenticated: false,

        login: (userData) => set({
          user: userData,
          isAuthenticated: true
        }),

        logout: () => set({
          user: null,
          isAuthenticated: false
        }),

        updateProfile: (updates) => set(state => ({
          user: { ...state.user, ...updates }
        })),

        getCurrentUser: () => get().user,
        isLoggedIn: () => get().isAuthenticated
      }));

      expect(userStore.state.user).toBeNull();
      expect(userStore.state.isAuthenticated).toBe(false);
      expect(typeof userStore.login).toBe('function');
      expect(typeof userStore.logout).toBe('function');
    });

    it('应该生成唯一的存储ID', () => {
      const store1 = zustand.create(() => ({ count: 0 }));
      const store2 = zustand.create(() => ({ count: 0 }));

      expect(store1.id).not.toBe(store2.id);
      expect(typeof store1.id).toBe('string');
      expect(store1.id).toContain('store_');
    });

    it('应该处理空创建函数', () => {
      const emptyStore = zustand.create(() => ({}));

      expect(emptyStore).toBeDefined();
      expect(emptyStore.state).toEqual({});
    });
  });

  describe('状态更新', () => {
    let counterStore;

    beforeEach(() => {
      counterStore = zustand.create((set, get) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 })),
        decrement: () => set(state => ({ count: state.count - 1 })),
        reset: () => set({ count: 0 }),
        incrementBy: (amount) => set(state => ({ count: state.count + amount })),
        getCount: () => get().count
      }));
    });

    it('应该能通过函数更新状态', () => {
      expect(counterStore.state.count).toBe(0);

      counterStore.increment();
      expect(counterStore.state.count).toBe(1);

      counterStore.increment();
      expect(counterStore.state.count).toBe(2);
    });

    it('应该能通过对象更新状态', () => {
      expect(counterStore.state.count).toBe(0);

      counterStore.setState({ count: 5 });
      expect(counterStore.state.count).toBe(5);

      counterStore.setState({ count: 10 });
      expect(counterStore.state.count).toBe(10);
    });

    it('应该能重置状态', () => {
      counterStore.increment();
      counterStore.increment();
      expect(counterStore.state.count).toBe(2);

      counterStore.reset();
      expect(counterStore.state.count).toBe(0);
    });

    it('应该能用参数更新状态', () => {
      expect(counterStore.state.count).toBe(0);

      counterStore.incrementBy(5);
      expect(counterStore.state.count).toBe(5);

      counterStore.incrementBy(3);
      expect(counterStore.state.count).toBe(8);
    });

    it('应该支持复杂的状态更新', () => {
      const todoStore = zustand.create((set) => ({
        todos: [],
        addTodo: (text) => set(state => ({
          todos: [...state.todos, { id: Date.now(), text, completed: false }]
        })),
        toggleTodo: (id) => set(state => ({
          todos: state.todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          )
        })),
        removeTodo: (id) => set(state => ({
          todos: state.todos.filter(todo => todo.id !== id)
        }))
      }));

      todoStore.addTodo('Learn Zustand');
      expect(todoStore.state.todos).toHaveLength(1);
      expect(todoStore.state.todos[0].text).toBe('Learn Zustand');
      expect(todoStore.state.todos[0].completed).toBe(false);

      const todoId = todoStore.state.todos[0].id;
      todoStore.toggleTodo(todoId);
      expect(todoStore.state.todos[0].completed).toBe(true);

      todoStore.removeTodo(todoId);
      expect(todoStore.state.todos).toHaveLength(0);
    });
  });

  describe('订阅机制', () => {
    let counterStore;

    beforeEach(() => {
      counterStore = zustand.create((set) => ({
        count: 0,
        increment: () => set(state => ({ count: state.count + 1 }))
      }));
    });

    it('应该能订阅状态变化', () => {
      let callCount = 0;
      let lastState = null;

      const unsubscribe = counterStore.subscribe((newState) => {
        callCount++;
        lastState = newState;
      });

      counterStore.increment();
      expect(callCount).toBe(1);
      expect(lastState.count).toBe(1);

      counterStore.increment();
      expect(callCount).toBe(2);
      expect(lastState.count).toBe(2);

      unsubscribe();
      counterStore.increment();
      expect(callCount).toBe(2); // 不再触发
    });

    it('应该支持多个订阅者', () => {
      let callCount1 = 0;
      let callCount2 = 0;

      const unsubscribe1 = counterStore.subscribe(() => callCount1++);
      counterStore.subscribe(() => callCount2++);

      counterStore.increment();
      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      unsubscribe1();
      counterStore.increment();
      expect(callCount1).toBe(1); // 不再触发
      expect(callCount2).toBe(2); // 继续触发
    });

    it('应该能正确取消订阅', () => {
      let callCount = 0;

      const unsubscribe = counterStore.subscribe(() => callCount++);
      expect(typeof unsubscribe).toBe('function');

      counterStore.increment();
      expect(callCount).toBe(1);

      unsubscribe();
      counterStore.increment();
      expect(callCount).toBe(1); // 不再触发

      // 再次取消订阅应该不报错
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('异步状态更新', () => {
    it('应该支持异步操作', async () => {
      const asyncStore = zustand.create((set, get) => ({
        loading: false,
        data: null,
        error: null,

        fetchData: async () => {
          set({ loading: true, error: null });
          try {
            // 模拟异步操作
            await new Promise(resolve => setTimeout(resolve, 10));
            set({ loading: false, data: 'success' });
          } catch (error) {
            set({ loading: false, error: error.message });
          }
        },

        getStatus: () => ({
          loading: get().loading,
          data: get().data,
          error: get().error
        })
      }));

      expect(asyncStore.state.loading).toBe(false);
      expect(asyncStore.state.data).toBeNull();

      await asyncStore.fetchData();

      expect(asyncStore.state.loading).toBe(false);
      expect(asyncStore.state.data).toBe('success');
      expect(asyncStore.state.error).toBeNull();
    });

    it('应该处理异步错误', async () => {
      const asyncStore = zustand.create((set) => ({
        loading: false,
        data: null,
        error: null,

        fetchWithError: async () => {
          set({ loading: true, error: null });
          try {
            await new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Network error')), 10)
            );
          } catch (error) {
            set({ loading: false, error: error.message });
          }
        }
      }));

      expect(asyncStore.state.error).toBeNull();

      await asyncStore.fetchWithError();

      expect(asyncStore.state.loading).toBe(false);
      expect(asyncStore.state.data).toBeNull();
      expect(asyncStore.state.error).toBe('Network error');
    });
  });

  describe('中间件支持', () => {
    it('应该支持中间件配置', () => {
      const middleware = { name: 'logger', fn: () => {} };
      const store = zustand.create(() => ({ count: 0 }), {
        middleware: [middleware]
      });

      expect(store.middleware).toEqual([middleware]);
    });

    it('应该处理空的中间件配置', () => {
      const store = zustand.create(() => ({ count: 0 }));

      expect(store.middleware).toEqual([]);
    });
  });

  describe('统计信息', () => {
    it('应该提供准确的统计信息', () => {
      expect(zustand.getStats()).toEqual({
        stores: 0,
        subscribers: 0,
        middlewares: 0
      });

      const store1 = zustand.create(() => ({ count: 0 }));
      expect(zustand.getStats().stores).toBe(1);

      const store2 = zustand.create(() => ({ count: 0 }));
      expect(zustand.getStats().stores).toBe(2);

      // 添加订阅者
      store1.subscribe(() => {});
      store2.subscribe(() => {});
      expect(zustand.getStats().subscribers).toBe(2);
    });

    it('应该实时更新统计信息', () => {
      const initialStats = zustand.getStats();

      const store = zustand.create(() => ({ count: 0 }));
      const afterCreateStats = zustand.getStats();

      expect(afterCreateStats.stores).toBe(initialStats.stores + 1);
      expect(afterCreateStats.subscribers).toBe(initialStats.subscribers);

      store.subscribe(() => {});
      const afterSubscribeStats = zustand.getStats();

      expect(afterSubscribeStats.subscribers).toBe(afterCreateStats.subscribers + 1);
    });
  });

  });

  describe('性能测试', () => {
    let perfZustand;

    beforeEach(async () => {
      perfZustand = new ZustandInspiredState();
      await perfZustand.initialize();
    });

    afterEach(async () => {
      if (perfZustand) {
        await perfZustand.destroy();
      }
      perfZustand = null;
    });

    it('应该能高效处理大量状态更新', () => {
      const perfStore = perfZustand.create((set) => ({
        counter: 0,
        increment: () => set(state => ({ counter: state.counter + 1 }))
      }));

      const startTime = global.performanceMonitor.start();

      for (let i = 0; i < 1000; i++) {
        perfStore.increment();
      }

      const perfResult = global.performanceMonitor.end(startTime);
      console.log(`1000次状态更新耗时: ${perfResult.formatted}`);

      expect(perfStore.state.counter).toBe(1000);
      expect(perfResult.duration).toBeLessThan(100); // 100ms内完成
    });

    it('应该能处理大量订阅者', () => {
      const perfStore = perfZustand.create((set) => ({
        value: 0,
        update: (val) => set({ value: val })
      }));

      const subscriberCount = 100;
      const callCounts = new Array(subscriberCount).fill(0);

      // 添加大量订阅者
      for (let i = 0; i < subscriberCount; i++) {
        perfStore.subscribe(() => {
          callCounts[i]++;
        });
      }

      perfStore.update(42);

      // 等待异步更新
      return new Promise(resolve => {
        setTimeout(() => {
          expect(callCounts.every(count => count === 1)).toBe(true);
          resolve();
        }, 10);
      });
    });

    it('应该能处理并发状态更新', async () => {
      const concurrentStore = perfZustand.create((set) => ({
        counters: [0, 0, 0],
        increment: (index) => set(state => ({
          counters: state.counters.map((c, i) => i === index ? c + 1 : c)
        }))
      }));

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(concurrentStore.increment(i % 3));
      }

      await Promise.all(promises);

      expect(concurrentStore.state.counters[0]).toBe(17);
      expect(concurrentStore.state.counters[1]).toBe(17);
      expect(concurrentStore.state.counters[2]).toBe(16);
    });
  });

  describe('错误处理', () => {
    let errorZustand;

    beforeEach(async () => {
      errorZustand = new ZustandInspiredState();
      await errorZustand.initialize();
    });

    afterEach(async () => {
      if (errorZustand) {
        await errorZustand.destroy();
      }
      errorZustand = null;
    });

    describe('创建函数验证', () => {
      it('应该处理无效的创建函数', () => {
        expect(() => errorZustand.create(null)).toThrow();
        expect(() => errorZustand.create(undefined)).toThrow();
        expect(() => errorZustand.create('not a function')).toThrow();
      });

      it('应该处理无效的状态更新', () => {
        const store = errorZustand.create(() => ({ count: 0 }));

        expect(() => store.setState(null)).toThrow();
        expect(() => store.setState(undefined)).toThrow();
      });

      it('应该处理订阅无效的监听器', () => {
        const store = errorZustand.create(() => ({ count: 0 }));

        expect(() => store.subscribe(null)).toThrow();
        expect(() => store.subscribe('not a function')).toThrow();
      });
    });

    describe('内存管理', () => {
      describe('订阅者清理', () => {
        it('应该正确清理订阅者', () => {
          const store = errorZustand.create(() => ({ count: 0 }));

          const unsubscribe1 = store.subscribe(() => {});
          const unsubscribe2 = store.subscribe(() => {});

          expect(errorZustand.getStats().subscribers).toBe(2); // 有两个订阅者

          unsubscribe1();
          // 订阅者数组中还有一个监听器

          unsubscribe2();
          // 现在订阅者数组为空
        });

        it('应该处理循环引用', () => {
          const store = errorZustand.create((set) => ({
            self: null,
            setSelf: () => set({ self: store }) // 直接引用store对象
          }));

          // 这应该不会导致内存泄漏
          store.setSelf();
          expect(store.state.self).toBeDefined();
          expect(store.state.self).toBe(store); // 应该引用自身
        });
      });
    });
  });
