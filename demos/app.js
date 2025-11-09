// frys Web界面应用逻辑

const { createApp, ref, reactive, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // 全局状态
    const currentView = ref('designer');
    const selectedNode = ref(null);
    const isDragging = ref(false);
    const dragOffset = reactive({ x: 0, y: 0 });

    // 工作流设计器状态
    const workflowNodes = ref([]);
    const workflowConnections = ref([]);
    const workflowStatus = ref('就绪');
    const nodeIdCounter = ref(1);

    // Agent管理系统状态
    const agents = ref([
      {
        id: 1,
        name: '数据分析Agent',
        type: 'analysis',
        status: 'online',
        description: '专门处理数据分析和可视化任务的智能Agent',
        taskCount: 45,
        uptime: '7天',
      },
      {
        id: 2,
        name: '内容生成Agent',
        type: 'content',
        status: 'online',
        description: '基于AI的内容创作和优化Agent',
        taskCount: 123,
        uptime: '15天',
      },
      {
        id: 3,
        name: 'API集成Agent',
        type: 'integration',
        status: 'offline',
        description: '负责外部API集成和数据同步的Agent',
        taskCount: 78,
        uptime: '3天',
      },
    ]);

    // 记忆网络状态
    const memoryStats = reactive({
      nodes: 1247,
      connections: 3842,
      queries: 15678,
    });

    const memoryQuery = ref('');
    const memoryResults = ref([]);

    // 插件市场状态
    const plugins = ref([
      {
        id: 1,
        name: 'OpenAI集成',
        icon: 'fab fa-openai',
        category: 'AI服务',
        description: '完整的OpenAI API集成，支持GPT模型和图像生成',
        downloads: 15420,
        rating: 4.8,
        author: 'frys官方',
        installed: true,
      },
      {
        id: 2,
        name: '数据库连接器',
        icon: 'fas fa-database',
        category: '数据存储',
        description: '支持MySQL、PostgreSQL、MongoDB等主流数据库的连接和操作',
        downloads: 8920,
        rating: 4.6,
        author: '数据专家',
        installed: false,
      },
      {
        id: 3,
        name: 'Web爬虫工具',
        icon: 'fas fa-spider',
        category: '数据采集',
        description: '智能Web爬虫，支持动态内容抓取和反爬虫策略',
        downloads: 6543,
        rating: 4.4,
        author: '爬虫大师',
        installed: true,
      },
      {
        id: 4,
        name: '邮件发送器',
        icon: 'fas fa-envelope',
        category: '通信',
        description: '企业级邮件发送服务，支持模板和批量发送',
        downloads: 11230,
        rating: 4.7,
        author: '通信专家',
        installed: false,
      },
    ]);

    // 工具函数
    const getNodeIcon = (type) => {
      const icons = {
        trigger: 'fas fa-bolt',
        ai: 'fas fa-brain',
        'data-processing': 'fas fa-filter',
        condition: 'fas fa-code-branch',
        loop: 'fas fa-redo',
      };
      return icons[type] || 'fas fa-cog';
    };

    const getNodeTitle = (type) => {
      const titles = {
        trigger: '触发器',
        ai: 'AI处理',
        'data-processing': '数据处理',
        condition: '条件判断',
        loop: '循环处理',
      };
      return titles[type] || '未知节点';
    };

    const getAgentIcon = (type) => {
      const icons = {
        analysis: 'fas fa-chart-bar',
        content: 'fas fa-edit',
        integration: 'fas fa-plug',
      };
      return icons[type] || 'fas fa-robot';
    };

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleString('zh-CN');
    };

    // 拖拽功能
    const onDragStart = (event, type) => {
      event.dataTransfer.setData('nodeType', type);
      event.dataTransfer.effectAllowed = 'copy';
    };

    const onDrop = (event) => {
      event.preventDefault();
      const canvas = event.currentTarget.querySelector('.canvas-content');
      const rect = canvas.getBoundingClientRect();

      const nodeType = event.dataTransfer.getData('nodeType');
      if (!nodeType) return;

      const x = event.clientX - rect.left - 100; // 100是节点宽度的一半
      const y = event.clientY - rect.top - 30; // 30是节点高度的一半

      addNode(nodeType, x, y);
    };

    const addNode = (type, x, y) => {
      const node = {
        id: `node_${nodeIdCounter.value++}`,
        type: type,
        position: { x: Math.max(0, x), y: Math.max(0, y) },
        inputs: type === 'trigger' ? [] : [{ id: 'input_1' }],
        outputs:
          type === 'condition'
            ? [{ id: 'output_true' }, { id: 'output_false' }]
            : [{ id: 'output_1' }],
        data: getDefaultNodeData(type),
      };

      workflowNodes.value.push(node);
      selectedNode.value = node;
    };

    const getDefaultNodeData = (type) => {
      const defaults = {
        trigger: {
          triggerType: 'webhook',
          description: '配置触发器参数',
        },
        ai: {
          model: 'gpt-4',
          prompt: '请分析以下内容...',
          description: '配置AI模型和提示词',
        },
        'data-processing': {
          operation: 'filter',
          description: '配置数据处理规则',
        },
        condition: {
          condition: 'value > 0',
          description: '配置条件判断逻辑',
        },
        loop: {
          iterations: 5,
          description: '配置循环参数',
        },
      };
      return defaults[type] || { description: '配置节点参数' };
    };

    const startDragNode = (event, node) => {
      if (event.target.closest('.node-delete')) return;

      isDragging.value = true;
      const startX = event.clientX - node.position.x;
      const startY = event.clientY - node.position.y;

      const onMouseMove = (e) => {
        if (!isDragging.value) return;

        node.position.x = e.clientX - startX;
        node.position.y = e.clientY - startY;
      };

      const onMouseUp = () => {
        isDragging.value = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const removeNode = (nodeId) => {
      const index = workflowNodes.value.findIndex((node) => node.id === nodeId);
      if (index > -1) {
        workflowNodes.value.splice(index, 1);
        if (selectedNode.value && selectedNode.value.id === nodeId) {
          selectedNode.value = null;
        }
        // 移除相关的连接
        workflowConnections.value = workflowConnections.value.filter(
          (conn) => conn.from.nodeId !== nodeId && conn.to.nodeId !== nodeId,
        );
      }
    };

    const getConnectionPath = (connection) => {
      const fromNode = workflowNodes.value.find(
        (n) => n.id === connection.from.nodeId,
      );
      const toNode = workflowNodes.value.find(
        (n) => n.id === connection.to.nodeId,
      );

      if (!fromNode || !toNode) return '';

      const fromX = fromNode.position.x + 200; // 节点宽度
      const fromY = fromNode.position.y + 40; // 节点高度的一半
      const toX = toNode.position.x;
      const toY = toNode.position.y + 40;

      // 贝塞尔曲线
      const midX = (fromX + toX) / 2;
      return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
    };

    // 工作流操作
    const loadTemplate = () => {
      // 加载预定义模板
      workflowNodes.value = [
        {
          id: 'node_1',
          type: 'trigger',
          position: { x: 50, y: 100 },
          inputs: [],
          outputs: [{ id: 'output_1' }],
          data: { triggerType: 'webhook', description: '接收外部触发' },
        },
        {
          id: 'node_2',
          type: 'ai',
          position: { x: 300, y: 100 },
          inputs: [{ id: 'input_1' }],
          outputs: [{ id: 'output_1' }],
          data: {
            model: 'gpt-4',
            prompt: '分析用户输入...',
            description: 'AI内容处理',
          },
        },
        {
          id: 'node_3',
          type: 'data-processing',
          position: { x: 550, y: 100 },
          inputs: [{ id: 'input_1' }],
          outputs: [{ id: 'output_1' }],
          data: { operation: 'format', description: '格式化输出结果' },
        },
      ];

      workflowConnections.value = [
        {
          id: 'conn_1',
          from: { nodeId: 'node_1', portId: 'output_1' },
          to: { nodeId: 'node_2', portId: 'input_1' },
        },
        {
          id: 'conn_2',
          from: { nodeId: 'node_2', portId: 'output_1' },
          to: { nodeId: 'node_3', portId: 'input_1' },
        },
      ];

      selectedNode.value = workflowNodes.value[0];
      workflowStatus.value = '模板已加载';
    };

    const runWorkflow = async () => {
      workflowStatus.value = '执行中...';

      try {
        // 模拟工作流执行
        for (let i = 0; i < workflowNodes.value.length; i++) {
          const node = workflowNodes.value[i];
          node.status = 'running';

          // 模拟处理时间
          await new Promise((resolve) => setTimeout(resolve, 1000));

          node.status = 'completed';
          workflowStatus.value = `执行节点 ${i + 1}/${workflowNodes.value.length}`;
        }

        workflowStatus.value = '执行完成';
      } catch (error) {
        workflowStatus.value = '执行失败';
        console.error('Workflow execution failed:', error);
      }
    };

    // 记忆网络功能
    const searchMemory = () => {
      if (!memoryQuery.value.trim()) {
        memoryResults.value = [];
        return;
      }

      // 模拟搜索结果
      memoryResults.value = [
        {
          id: 1,
          type: '对话',
          content: `关于"${memoryQuery.value}"的对话记录...`,
          timestamp: Date.now() - 3600000,
          relevance: 0.95,
          accessCount: 12,
        },
        {
          id: 2,
          type: '知识',
          content: `与"${memoryQuery.value}"相关的知识点...`,
          timestamp: Date.now() - 7200000,
          relevance: 0.87,
          accessCount: 8,
        },
        {
          id: 3,
          type: '决策',
          content: `基于"${memoryQuery.value}"的决策记录...`,
          timestamp: Date.now() - 10800000,
          relevance: 0.76,
          accessCount: 5,
        },
      ];
    };

    // 初始化
    onMounted(() => {
      console.log('frys Web界面已初始化');
    });

    return {
      // 状态
      currentView,
      selectedNode,
      workflowNodes,
      workflowConnections,
      workflowStatus,
      agents,
      memoryStats,
      memoryQuery,
      memoryResults,
      plugins,

      // 方法
      getNodeIcon,
      getNodeTitle,
      getAgentIcon,
      formatTime,
      onDragStart,
      onDrop,
      startDragNode,
      removeNode,
      getConnectionPath,
      loadTemplate,
      runWorkflow,
      searchMemory,
    };
  },
}).mount('#app');
