import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStatus,
  WorkflowExecutionResult
} from '@/types';

interface WorkflowState {
  // Definitions
  definitions: WorkflowDefinition[];
  definitionsLoading: boolean;
  definitionsError: string | null;
  selectedDefinition: WorkflowDefinition | null;

  // Instances
  instances: WorkflowInstance[];
  instancesLoading: boolean;
  instancesError: string | null;
  selectedInstance: WorkflowInstance | null;

  // Execution results
  executionResults: Record<string, WorkflowExecutionResult[]>;
  executionLogs: Record<string, any[]>;

  // Real-time monitoring
  activeInstances: Map<string, WorkflowInstance>;
  instanceSubscriptions: Map<string, WebSocket>;

  // Filters and pagination
  definitionFilters: {
    query?: string;
    status?: WorkflowStatus;
    tags?: string[];
  };
  instanceFilters: {
    definitionId?: string;
    status?: WorkflowStatus;
    startedAfter?: string;
    startedBefore?: string;
  };
  pagination: {
    definitions: { page: number; limit: number; total: number };
    instances: { page: number; limit: number; total: number };
  };

  // Actions
  // Definitions
  setDefinitions: (definitions: WorkflowDefinition[], total?: number) => void;
  addDefinition: (definition: WorkflowDefinition) => void;
  updateDefinition: (id: string, updates: Partial<WorkflowDefinition>) => void;
  removeDefinition: (id: string) => void;
  setSelectedDefinition: (definition: WorkflowDefinition | null) => void;
  setDefinitionsLoading: (loading: boolean) => void;
  setDefinitionsError: (error: string | null) => void;

  // Instances
  setInstances: (instances: WorkflowInstance[], total?: number) => void;
  addInstance: (instance: WorkflowInstance) => void;
  updateInstance: (id: string, updates: Partial<WorkflowInstance>) => void;
  removeInstance: (id: string) => void;
  setSelectedInstance: (instance: WorkflowInstance | null) => void;
  setInstancesLoading: (loading: boolean) => void;
  setInstancesError: (error: string | null) => void;

  // Execution data
  setExecutionResults: (instanceId: string, results: WorkflowExecutionResult[]) => void;
  setExecutionLogs: (instanceId: string, logs: any[]) => void;

  // Real-time monitoring
  startInstanceMonitoring: (instanceId: string) => void;
  stopInstanceMonitoring: (instanceId: string) => void;
  updateActiveInstance: (instanceId: string, updates: Partial<WorkflowInstance>) => void;

  // Filters
  setDefinitionFilters: (filters: Partial<WorkflowState['definitionFilters']>) => void;
  setInstanceFilters: (filters: Partial<WorkflowState['instanceFilters']>) => void;
  setPagination: (type: 'definitions' | 'instances', pagination: Partial<WorkflowState['pagination']['definitions']>) => void;

  // Computed values
  getRunningInstances: () => WorkflowInstance[];
  getFailedInstances: () => WorkflowInstance[];
  getCompletedInstances: () => WorkflowInstance[];
  getInstancesByDefinition: (definitionId: string) => WorkflowInstance[];
  getInstanceStats: () => {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending: number;
  };
}

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    definitions: [],
    definitionsLoading: false,
    definitionsError: null,
    selectedDefinition: null,

    instances: [],
    instancesLoading: false,
    instancesError: null,
    selectedInstance: null,

    executionResults: {},
    executionLogs: {},

    activeInstances: new Map(),
    instanceSubscriptions: new Map(),

    definitionFilters: {},
    instanceFilters: {},
    pagination: {
      definitions: { page: 1, limit: 20, total: 0 },
      instances: { page: 1, limit: 20, total: 0 },
    },

    // Actions
    setDefinitions: (definitions: WorkflowDefinition[], total?: number) => {
      set((state) => ({
        definitions,
        pagination: {
          ...state.pagination,
          definitions: {
            ...state.pagination.definitions,
            total: total ?? definitions.length,
          },
        },
      }));
    },

    addDefinition: (definition: WorkflowDefinition) => {
      set((state) => ({
        definitions: [definition, ...state.definitions],
      }));
    },

    updateDefinition: (id: string, updates: Partial<WorkflowDefinition>) => {
      set((state) => ({
        definitions: state.definitions.map((def) =>
          def.id === id ? { ...def, ...updates } : def
        ),
        selectedDefinition: state.selectedDefinition?.id === id
          ? { ...state.selectedDefinition, ...updates }
          : state.selectedDefinition,
      }));
    },

    removeDefinition: (id: string) => {
      set((state) => ({
        definitions: state.definitions.filter((def) => def.id !== id),
        selectedDefinition: state.selectedDefinition?.id === id ? null : state.selectedDefinition,
      }));
    },

    setSelectedDefinition: (definition: WorkflowDefinition | null) => {
      set({ selectedDefinition: definition });
    },

    setDefinitionsLoading: (loading: boolean) => {
      set({ definitionsLoading: loading });
    },

    setDefinitionsError: (error: string | null) => {
      set({ definitionsError: error });
    },

    setInstances: (instances: WorkflowInstance[], total?: number) => {
      set((state) => ({
        instances,
        pagination: {
          ...state.pagination,
          instances: {
            ...state.pagination.instances,
            total: total ?? instances.length,
          },
        },
      }));
    },

    addInstance: (instance: WorkflowInstance) => {
      set((state) => ({
        instances: [instance, ...state.instances],
      }));
    },

    updateInstance: (id: string, updates: Partial<WorkflowInstance>) => {
      set((state) => ({
        instances: state.instances.map((inst) =>
          inst.id === id ? { ...inst, ...updates } : inst
        ),
        selectedInstance: state.selectedInstance?.id === id
          ? { ...state.selectedInstance, ...updates }
          : state.selectedInstance,
      }));

      // Also update active instances
      const state = get();
      if (state.activeInstances.has(id)) {
        state.activeInstances.set(id, {
          ...state.activeInstances.get(id)!,
          ...updates,
        });
      }
    },

    removeInstance: (id: string) => {
      set((state) => ({
        instances: state.instances.filter((inst) => inst.id !== id),
        selectedInstance: state.selectedInstance?.id === id ? null : state.selectedInstance,
      }));

      // Also remove from active instances
      const state = get();
      state.activeInstances.delete(id);
    },

    setSelectedInstance: (instance: WorkflowInstance | null) => {
      set({ selectedInstance: instance });
    },

    setInstancesLoading: (loading: boolean) => {
      set({ instancesLoading: loading });
    },

    setInstancesError: (error: string | null) => {
      set({ instancesError: error });
    },

    setExecutionResults: (instanceId: string, results: WorkflowExecutionResult[]) => {
      set((state) => ({
        executionResults: {
          ...state.executionResults,
          [instanceId]: results,
        },
      }));
    },

    setExecutionLogs: (instanceId: string, logs: any[]) => {
      set((state) => ({
        executionLogs: {
          ...state.executionLogs,
          [instanceId]: logs,
        },
      }));
    },

    startInstanceMonitoring: (instanceId: string) => {
      const state = get();

      // Clean up existing subscription
      if (state.instanceSubscriptions.has(instanceId)) {
        state.instanceSubscriptions.get(instanceId)!.close();
      }

      try {
        const ws = new WebSocket(`ws://localhost:8080/ws/workflows/instances/${instanceId}`);

        ws.onopen = () => {
          console.log(`Started monitoring workflow instance ${instanceId}`);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'instance_update') {
              get().updateActiveInstance(instanceId, data.payload);
            }
          } catch (error) {
            console.error('Failed to parse workflow instance data:', error);
          }
        };

        ws.onclose = () => {
          console.log(`Stopped monitoring workflow instance ${instanceId}`);
          state.instanceSubscriptions.delete(instanceId);
        };

        ws.onerror = (error) => {
          console.error(`Workflow instance monitoring error for ${instanceId}:`, error);
          state.instanceSubscriptions.delete(instanceId);
        };

        state.instanceSubscriptions.set(instanceId, ws);
      } catch (error) {
        console.error(`Failed to start monitoring workflow instance ${instanceId}:`, error);
      }
    },

    stopInstanceMonitoring: (instanceId: string) => {
      const state = get();
      const subscription = state.instanceSubscriptions.get(instanceId);
      if (subscription) {
        subscription.close();
        state.instanceSubscriptions.delete(instanceId);
        state.activeInstances.delete(instanceId);
      }
    },

    updateActiveInstance: (instanceId: string, updates: Partial<WorkflowInstance>) => {
      const state = get();
      const current = state.activeInstances.get(instanceId);
      if (current) {
        state.activeInstances.set(instanceId, { ...current, ...updates });
        // Also update in the instances array
        get().updateInstance(instanceId, updates);
      }
    },

    setDefinitionFilters: (filters: Partial<WorkflowState['definitionFilters']>) => {
      set((state) => ({
        definitionFilters: { ...state.definitionFilters, ...filters },
      }));
    },

    setInstanceFilters: (filters: Partial<WorkflowState['instanceFilters']>) => {
      set((state) => ({
        instanceFilters: { ...state.instanceFilters, ...filters },
      }));
    },

    setPagination: (type: 'definitions' | 'instances', pagination: Partial<WorkflowState['pagination']['definitions']>) => {
      set((state) => ({
        pagination: {
          ...state.pagination,
          [type]: {
            ...state.pagination[type],
            ...pagination,
          },
        },
      }));
    },

    // Computed values
    getRunningInstances: () => {
      const state = get();
      return state.instances.filter((inst) => inst.status === 'running');
    },

    getFailedInstances: () => {
      const state = get();
      return state.instances.filter((inst) => inst.status === 'failed');
    },

    getCompletedInstances: () => {
      const state = get();
      return state.instances.filter((inst) => inst.status === 'completed');
    },

    getInstancesByDefinition: (definitionId: string) => {
      const state = get();
      return state.instances.filter((inst) => inst.definitionId === definitionId);
    },

    getInstanceStats: () => {
      const state = get();
      const stats = {
        total: state.instances.length,
        running: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      };

      state.instances.forEach((inst) => {
        switch (inst.status) {
          case 'running':
            stats.running++;
            break;
          case 'completed':
            stats.completed++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'pending':
            stats.pending++;
            break;
        }
      });

      return stats;
    },
  }))
);

// Selectors for common workflow queries
export const useWorkflowSelectors = () => {
  const store = useWorkflowStore();

  return {
    // Instance stats
    instanceStats: store.getInstanceStats(),
    runningInstances: store.getRunningInstances(),
    failedInstances: store.getFailedInstances(),
    completedInstances: store.getCompletedInstances(),

    // Filtered data
    filteredDefinitions: store.definitions.filter((def) => {
      const filters = store.definitionFilters;
      if (filters.query && !def.name.toLowerCase().includes(filters.query.toLowerCase())) {
        return false;
      }
      return true;
    }),

    filteredInstances: store.instances.filter((inst) => {
      const filters = store.instanceFilters;
      if (filters.definitionId && inst.definitionId !== filters.definitionId) {
        return false;
      }
      if (filters.status && inst.status !== filters.status) {
        return false;
      }
      return true;
    }),

    // Active monitoring
    monitoredInstances: Array.from(store.activeInstances.values()),
    isInstanceMonitored: (instanceId: string) => store.instanceSubscriptions.has(instanceId),

    // Execution data
    getExecutionResults: (instanceId: string) => store.executionResults[instanceId] || [],
    getExecutionLogs: (instanceId: string) => store.executionLogs[instanceId] || [],
  };
};
