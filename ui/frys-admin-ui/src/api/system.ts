import { apiClient } from './client';
import {
  SystemStatus,
  SystemMetrics,
  SystemConfig,
  ApiResponse
} from '@/types';

// System management API
export class SystemAPI {
  // Get system status
  static async getStatus(): Promise<ApiResponse<SystemStatus>> {
    return apiClient.get('/system/status');
  }

  // Get system metrics
  static async getMetrics(): Promise<ApiResponse<SystemMetrics>> {
    return apiClient.get('/system/metrics');
  }

  // Get real-time metrics stream
  static getMetricsStream(onMessage: (metrics: SystemMetrics) => void): WebSocket {
    const ws = apiClient.connectWebSocket('/ws/system/metrics');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'metrics') {
          onMessage(data.payload);
        }
      } catch (error) {
        console.error('Failed to parse metrics data:', error);
      }
    };

    return ws;
  }

  // Get system configuration
  static async getConfig(): Promise<ApiResponse<SystemConfig>> {
    return apiClient.get('/system/config');
  }

  // Update system configuration
  static async updateConfig(config: Partial<SystemConfig>): Promise<ApiResponse<SystemConfig>> {
    return apiClient.put('/system/config', config);
  }

  // Restart system
  static async restart(): Promise<ApiResponse> {
    return apiClient.post('/system/restart');
  }

  // Shutdown system
  static async shutdown(): Promise<ApiResponse> {
    return apiClient.post('/system/shutdown');
  }

  // Get system logs
  static async getLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit: number = 100,
    before?: string
  ): Promise<ApiResponse<any[]>> {
    return apiClient.get('/system/logs', {
      params: { level, limit, before },
    });
  }

  // Get logs stream
  static getLogsStream(
    onLog: (log: any) => void,
    level?: 'debug' | 'info' | 'warn' | 'error'
  ): WebSocket {
    const ws = apiClient.connectWebSocket('/ws/system/logs');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log' && (!level || data.payload.level === level)) {
          onLog(data.payload);
        }
      } catch (error) {
        console.error('Failed to parse log data:', error);
      }
    };

    return ws;
  }

  // Clear system logs
  static async clearLogs(): Promise<ApiResponse> {
    return apiClient.delete('/system/logs');
  }

  // Get system information
  static async getInfo(): Promise<ApiResponse<{
    version: string;
    buildTime: string;
    commitHash: string;
    goVersion: string;
    os: string;
    arch: string;
    uptime: number;
  }>> {
    return apiClient.get('/system/info');
  }

  // Perform system health check
  static async healthCheck(): Promise<ApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration: number;
    }>;
    timestamp: string;
  }>> {
    return apiClient.get('/system/health');
  }

  // Get system backup status
  static async getBackupStatus(): Promise<ApiResponse<{
    lastBackup: string;
    nextBackup: string;
    size: number;
    status: 'idle' | 'running' | 'failed';
  }>> {
    return apiClient.get('/system/backup/status');
  }

  // Create system backup
  static async createBackup(): Promise<ApiResponse<{
    backupId: string;
    status: 'started';
  }>> {
    return apiClient.post('/system/backup');
  }

  // Restore from backup
  static async restoreBackup(backupId: string): Promise<ApiResponse> {
    return apiClient.post(`/system/backup/${backupId}/restore`);
  }

  // Get system performance profile
  static async getPerformanceProfile(): Promise<ApiResponse<{
    cpu: {
      usage: number;
      load: number[];
      threads: number;
    };
    memory: {
      used: number;
      total: number;
      gc: {
        collections: number;
        pauseTime: number;
      };
    };
    goroutines: number;
    heap: {
      allocated: number;
      objects: number;
      releases: number;
    };
  }>> {
    return apiClient.get('/system/performance');
  }

  // Enable performance profiling
  static async enableProfiling(type: 'cpu' | 'memory' | 'block' | 'mutex'): Promise<ApiResponse> {
    return apiClient.post(`/system/profiling/${type}/enable`);
  }

  // Disable performance profiling
  static async disableProfiling(type: 'cpu' | 'memory' | 'block' | 'mutex'): Promise<ApiResponse> {
    return apiClient.post(`/system/profiling/${type}/disable`);
  }

  // Download profiling data
  static async downloadProfile(type: 'cpu' | 'memory' | 'block' | 'mutex'): Promise<Blob> {
    const response = await apiClient.get(`/system/profiling/${type}/download`, {
      responseType: 'blob',
    });
    return response as any;
  }
}
