import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { WorkflowAPI } from '@/api/workflow';
import { useWorkflowStore } from '@/stores/workflow';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStatus,
  SearchParams
} from '@/types';
import { useEffect } from 'react';

// Workflow definitions query
export const useWorkflowDefinitions = (params?: SearchParams) => {
  const setDefinitions = useWorkflowStore((state) => state.setDefinitions);
  const setLoading = useWorkflowStore((state) => state.setDefinitionsLoading);
  const setError = useWorkflowStore((state) => state.setDefinitionsError);

  return useQuery({
    queryKey: ['workflows', 'definitions', params],
    queryFn: async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await WorkflowAPI.getDefinitions(params);
        if (response.success) {
          setDefinitions(response.data!, response.meta?.total);
          return response;
        }
        throw new Error(response.error?.message || 'Failed to fetch workflow definitions');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

// Single workflow definition query
export const useWorkflowDefinition = (id: string) => {
  const setSelectedDefinition = useWorkflowStore((state) => state.setSelectedDefinition);

  return useQuery({
    queryKey: ['workflows', 'definitions', id],
    queryFn: async () => {
      const response = await WorkflowAPI.getDefinition(id);
      if (response.success) {
        setSelectedDefinition(response.data!);
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch workflow definition');
    },
    enabled: !!id,
    staleTime: 60000, // Consider data stale after 1 minute
  });
};

// Create workflow definition mutation
export const useCreateWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  const addDefinition = useWorkflowStore((state) => state.addDefinition);

  return useMutation({
    mutationFn: async (definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await WorkflowAPI.createDefinition(definition);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to create workflow definition');
    },
    onSuccess: (data) => {
      addDefinition(data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
  });
};

// Update workflow definition mutation
export const useUpdateWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  const updateDefinition = useWorkflowStore((state) => state.updateDefinition);

  return useMutation({
    mutationFn: async ({ id, definition }: { id: string; definition: Partial<WorkflowDefinition> }) => {
      const response = await WorkflowAPI.updateDefinition(id, definition);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to update workflow definition');
    },
    onSuccess: (data, variables) => {
      updateDefinition(variables.id, data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions', variables.id] });
    },
  });
};

// Delete workflow definition mutation
export const useDeleteWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  const removeDefinition = useWorkflowStore((state) => state.removeDefinition);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await WorkflowAPI.deleteDefinition(id);
      if (response.success) {
        return id;
      }
      throw new Error(response.error?.message || 'Failed to delete workflow definition');
    },
    onSuccess: (id) => {
      removeDefinition(id);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
  });
};

// Clone workflow definition mutation
export const useCloneWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  const addDefinition = useWorkflowStore((state) => state.addDefinition);

  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const response = await WorkflowAPI.cloneDefinition(id, newName);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to clone workflow definition');
    },
    onSuccess: (data) => {
      addDefinition(data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
  });
};

// Workflow instances query with infinite scroll
export const useWorkflowInstances = (params?: SearchParams & {
  definitionId?: string;
  status?: WorkflowStatus;
  startedAfter?: string;
  startedBefore?: string;
}) => {
  const setInstances = useWorkflowStore((state) => state.setInstances);
  const setLoading = useWorkflowStore((state) => state.setInstancesLoading);
  const setError = useWorkflowStore((state) => state.setInstancesError);

  return useInfiniteQuery({
    queryKey: ['workflows', 'instances', params],
    queryFn: async ({ pageParam = 1 }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await WorkflowAPI.getInstances({
          ...params,
          page: pageParam,
          limit: params?.limit || 20,
        });

        if (response.success) {
          if (pageParam === 1) {
            setInstances(response.data!, response.meta?.total);
          }
          return response;
        }
        throw new Error(response.error?.message || 'Failed to fetch workflow instances');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
        throw error;
      } finally {
        setLoading(false);
      }
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta) {
        const { page, totalPages } = lastPage.meta;
        return page < totalPages ? page + 1 : undefined;
      }
      return undefined;
    },
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

// Single workflow instance query
export const useWorkflowInstance = (id: string) => {
  const setSelectedInstance = useWorkflowStore((state) => state.setSelectedInstance);
  const setExecutionResults = useWorkflowStore((state) => state.setExecutionResults);
  const setExecutionLogs = useWorkflowStore((state) => state.setExecutionLogs);

  return useQuery({
    queryKey: ['workflows', 'instances', id],
    queryFn: async () => {
      const [instanceResponse, resultsResponse, logsResponse] = await Promise.all([
        WorkflowAPI.getInstance(id),
        WorkflowAPI.getExecutionResults(id),
        WorkflowAPI.getExecutionLogs(id),
      ]);

      if (instanceResponse.success) {
        setSelectedInstance(instanceResponse.data!);

        if (resultsResponse.success) {
          setExecutionResults(id, resultsResponse.data!);
        }

        if (logsResponse.success) {
          setExecutionLogs(id, logsResponse.data!);
        }

        return instanceResponse.data!;
      }
      throw new Error(instanceResponse.error?.message || 'Failed to fetch workflow instance');
    },
    enabled: !!id,
    staleTime: 5000, // Consider data stale after 5 seconds for running instances
  });
};

// Start workflow instance mutation
export const useStartWorkflowInstance = () => {
  const queryClient = useQueryClient();
  const addInstance = useWorkflowStore((state) => state.addInstance);

  return useMutation({
    mutationFn: async ({ definitionId, context }: { definitionId: string; context?: Record<string, any> }) => {
      const response = await WorkflowAPI.startInstance(definitionId, context);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to start workflow instance');
    },
    onSuccess: (data) => {
      addInstance(data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances'] });
    },
  });
};

// Stop workflow instance mutation
export const useStopWorkflowInstance = () => {
  const queryClient = useQueryClient();
  const updateInstance = useWorkflowStore((state) => state.updateInstance);

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await WorkflowAPI.stopInstance(id);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to stop workflow instance');
    },
    onSuccess: (data, id) => {
      updateInstance(id, data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances', id] });
    },
  });
};

// Workflow statistics query
export const useWorkflowStatistics = (timeRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: ['workflows', 'statistics', timeRange],
    queryFn: async () => {
      const response = await WorkflowAPI.getStatistics(timeRange);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch workflow statistics');
    },
    staleTime: 60000, // Consider data stale after 1 minute
  });
};

// Workflow performance metrics query
export const useWorkflowPerformance = (definitionId?: string) => {
  return useQuery({
    queryKey: ['workflows', 'performance', definitionId],
    queryFn: async () => {
      const response = await WorkflowAPI.getPerformanceMetrics(definitionId);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch workflow performance');
    },
    staleTime: 300000, // Consider data stale after 5 minutes
  });
};

// Workflow templates query
export const useWorkflowTemplates = (category?: string) => {
  return useQuery({
    queryKey: ['workflows', 'templates', category],
    queryFn: async () => {
      const response = await WorkflowAPI.getTemplates(category);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch workflow templates');
    },
    staleTime: 300000, // Consider data stale after 5 minutes
  });
};

// Create workflow from template mutation
export const useCreateFromTemplate = () => {
  const queryClient = useQueryClient();
  const addDefinition = useWorkflowStore((state) => state.addDefinition);

  return useMutation({
    mutationFn: async ({ templateId, name }: { templateId: string; name: string }) => {
      const response = await WorkflowAPI.createFromTemplate(templateId, name);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to create workflow from template');
    },
    onSuccess: (data) => {
      addDefinition(data);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
  });
};

// Validate workflow definition mutation
export const useValidateWorkflowDefinition = () => {
  return useMutation({
    mutationFn: async (definition: WorkflowDefinition) => {
      const response = await WorkflowAPI.validateDefinition(definition);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to validate workflow definition');
    },
  });
};

// Test workflow execution mutation
export const useTestWorkflowExecution = () => {
  return useMutation({
    mutationFn: async ({ definitionId, testData }: { definitionId: string; testData?: Record<string, any> }) => {
      const response = await WorkflowAPI.testExecution(definitionId, testData);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to test workflow execution');
    },
  });
};

// Bulk operations mutations
export const useBulkStartWorkflows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ definitionId, count, context }: { definitionId: string; count: number; context?: Record<string, any> }) => {
      const response = await WorkflowAPI.bulkStart(definitionId, count, context);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to bulk start workflows');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances'] });
    },
  });
};

export const useBulkStopWorkflows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceIds: string[]) => {
      const response = await WorkflowAPI.bulkStop(instanceIds);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to bulk stop workflows');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances'] });
    },
  });
};

export const useBulkDeleteWorkflows = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceIds: string[]) => {
      const response = await WorkflowAPI.bulkDelete(instanceIds);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to bulk delete workflows');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', 'instances'] });
    },
  });
};

// Real-time instance monitoring hook
export const useWorkflowInstanceMonitoring = (instanceId: string) => {
  const { startInstanceMonitoring, stopInstanceMonitoring } = useWorkflowStore();

  useEffect(() => {
    if (instanceId) {
      startInstanceMonitoring(instanceId);
    }

    return () => {
      if (instanceId) {
        stopInstanceMonitoring(instanceId);
      }
    };
  }, [instanceId, startInstanceMonitoring, stopInstanceMonitoring]);

  return {};
};
