import { apiClient } from './client';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowExecutionResult,
  WorkflowStatus,
  PaginatedResponse,
  ApiResponse,
  SearchParams
} from '@/types';

// Workflow management API
export class WorkflowAPI {
  // Workflow Definitions

  // Get all workflow definitions
  static async getDefinitions(params?: SearchParams): Promise<PaginatedResponse<WorkflowDefinition>> {
    return apiClient.getPaginated('/workflows/definitions', params?.page, params?.limit, {
      query: params?.query,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
    });
  }

  // Get workflow definition by ID
  static async getDefinition(id: string): Promise<ApiResponse<WorkflowDefinition>> {
    return apiClient.get(`/workflows/definitions/${id}`);
  }

  // Create new workflow definition
  static async createDefinition(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<WorkflowDefinition>> {
    return apiClient.post('/workflows/definitions', definition);
  }

  // Update workflow definition
  static async updateDefinition(id: string, definition: Partial<WorkflowDefinition>): Promise<ApiResponse<WorkflowDefinition>> {
    return apiClient.put(`/workflows/definitions/${id}`, definition);
  }

  // Delete workflow definition
  static async deleteDefinition(id: string): Promise<ApiResponse> {
    return apiClient.delete(`/workflows/definitions/${id}`);
  }

  // Clone workflow definition
  static async cloneDefinition(id: string, newName: string): Promise<ApiResponse<WorkflowDefinition>> {
    return apiClient.post(`/workflows/definitions/${id}/clone`, { name: newName });
  }

  // Export workflow definition
  static async exportDefinition(id: string): Promise<Blob> {
    const response = await apiClient.get(`/workflows/definitions/${id}/export`, {
      responseType: 'blob',
    });
    return response as any;
  }

  // Import workflow definition
  static async importDefinition(file: File): Promise<ApiResponse<WorkflowDefinition>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/workflows/definitions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // Workflow Instances

  // Get all workflow instances
  static async getInstances(params?: SearchParams & {
    definitionId?: string;
    status?: WorkflowStatus;
    startedAfter?: string;
    startedBefore?: string;
  }): Promise<PaginatedResponse<WorkflowInstance>> {
    return apiClient.getPaginated('/workflows/instances', params?.page, params?.limit, {
      definitionId: params?.definitionId,
      status: params?.status,
      startedAfter: params?.startedAfter,
      startedBefore: params?.startedBefore,
      query: params?.query,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
    });
  }

  // Get workflow instance by ID
  static async getInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.get(`/workflows/instances/${id}`);
  }

  // Start new workflow instance
  static async startInstance(definitionId: string, context?: Record<string, any>): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post('/workflows/instances', {
      definitionId,
      context: context || {},
    });
  }

  // Stop workflow instance
  static async stopInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post(`/workflows/instances/${id}/stop`);
  }

  // Pause workflow instance
  static async pauseInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post(`/workflows/instances/${id}/pause`);
  }

  // Resume workflow instance
  static async resumeInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post(`/workflows/instances/${id}/resume`);
  }

  // Cancel workflow instance
  static async cancelInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post(`/workflows/instances/${id}/cancel`);
  }

  // Retry failed workflow instance
  static async retryInstance(id: string): Promise<ApiResponse<WorkflowInstance>> {
    return apiClient.post(`/workflows/instances/${id}/retry`);
  }

  // Get workflow execution results
  static async getExecutionResults(instanceId: string): Promise<ApiResponse<WorkflowExecutionResult[]>> {
    return apiClient.get(`/workflows/instances/${instanceId}/results`);
  }

  // Get workflow execution logs
  static async getExecutionLogs(instanceId: string, nodeId?: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/workflows/instances/${instanceId}/logs`, {
      params: { nodeId },
    });
  }

  // Real-time workflow monitoring
  static getInstanceStream(instanceId: string, onUpdate: (instance: WorkflowInstance) => void): WebSocket {
    const ws = apiClient.connectWebSocket(`/ws/workflows/instances/${instanceId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'instance_update') {
          onUpdate(data.payload);
        }
      } catch (error) {
        console.error('Failed to parse workflow instance data:', error);
      }
    };

    return ws;
  }

  // Workflow Statistics

  // Get workflow statistics
  static async getStatistics(timeRange?: {
    start: string;
    end: string;
  }): Promise<ApiResponse<{
    totalDefinitions: number;
    totalInstances: number;
    runningInstances: number;
    completedInstances: number;
    failedInstances: number;
    averageExecutionTime: number;
    successRate: number;
    popularDefinitions: Array<{
      definitionId: string;
      name: string;
      executionCount: number;
    }>;
    statusDistribution: Record<WorkflowStatus, number>;
  }>> {
    return apiClient.get('/workflows/statistics', {
      params: timeRange,
    });
  }

  // Get workflow performance metrics
  static async getPerformanceMetrics(definitionId?: string): Promise<ApiResponse<{
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
    throughput: number; // instances per hour
    errorRate: number;
    nodePerformance: Array<{
      nodeId: string;
      nodeName: string;
      averageTime: number;
      successRate: number;
      executionCount: number;
    }>;
  }>> {
    return apiClient.get('/workflows/performance', {
      params: { definitionId },
    });
  }

  // Workflow Templates

  // Get workflow templates
  static async getTemplates(category?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    definition: WorkflowDefinition;
    usageCount: number;
  }>>> {
    return apiClient.get('/workflows/templates', {
      params: { category },
    });
  }

  // Create workflow from template
  static async createFromTemplate(templateId: string, name: string): Promise<ApiResponse<WorkflowDefinition>> {
    return apiClient.post(`/workflows/templates/${templateId}/create`, { name });
  }

  // Workflow Validation

  // Validate workflow definition
  static async validateDefinition(definition: WorkflowDefinition): Promise<ApiResponse<{
    valid: boolean;
    errors: Array<{
      nodeId?: string;
      edgeId?: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }>;
    suggestions: string[];
  }>> {
    return apiClient.post('/workflows/validate', definition);
  }

  // Test workflow execution
  static async testExecution(definitionId: string, testData?: Record<string, any>): Promise<ApiResponse<{
    success: boolean;
    results: WorkflowExecutionResult[];
    duration: number;
    errors: string[];
  }>> {
    return apiClient.post(`/workflows/definitions/${definitionId}/test`, {
      testData: testData || {},
    });
  }

  // Bulk Operations

  // Bulk start workflows
  static async bulkStart(definitionId: string, count: number, context?: Record<string, any>): Promise<ApiResponse<{
    instances: WorkflowInstance[];
    failed: number;
  }>> {
    return apiClient.post('/workflows/bulk/start', {
      definitionId,
      count,
      context: context || {},
    });
  }

  // Bulk stop workflows
  static async bulkStop(instanceIds: string[]): Promise<ApiResponse<{
    stopped: number;
    failed: number;
  }>> {
    return apiClient.post('/workflows/bulk/stop', { instanceIds });
  }

  // Bulk delete workflow instances
  static async bulkDelete(instanceIds: string[]): Promise<ApiResponse<{
    deleted: number;
    failed: number;
  }>> {
    return apiClient.post('/workflows/bulk/delete', { instanceIds });
  }
}
