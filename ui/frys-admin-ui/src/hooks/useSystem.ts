import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SystemAPI } from '@/api/system';
import { useSystemStore } from '@/stores/system';
import { SystemStatus, SystemMetrics, SystemConfig } from '@/types';
import { useEffect } from 'react';

// System status query
export const useSystemStatus = () => {
  return useQuery({
    queryKey: ['system', 'status'],
    queryFn: async () => {
      const response = await SystemAPI.getStatus();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch system status');
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

// System metrics query
export const useSystemMetrics = () => {
  const setMetrics = useSystemStore((state) => state.setMetrics);

  return useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: async () => {
      const response = await SystemAPI.getMetrics();
      if (response.success) {
        setMetrics(response.data!);
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch system metrics');
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
};

// System configuration query
export const useSystemConfig = () => {
  return useQuery({
    queryKey: ['system', 'config'],
    queryFn: async () => {
      const response = await SystemAPI.getConfig();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch system config');
    },
    staleTime: 60000, // Consider data stale after 1 minute
  });
};

// Update system configuration mutation
export const useUpdateSystemConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<SystemConfig>) => {
      const response = await SystemAPI.updateConfig(config);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to update system config');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['system', 'config'], data);
    },
  });
};

// System logs query
export const useSystemLogs = (params?: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  limit?: number;
  before?: string;
}) => {
  return useQuery({
    queryKey: ['system', 'logs', params],
    queryFn: async () => {
      const response = await SystemAPI.getLogs(
        params?.level,
        params?.limit || 100,
        params?.before
      );
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch system logs');
    },
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

// System health check query
export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      const response = await SystemAPI.healthCheck();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to check system health');
    },
    refetchInterval: 10000, // Check every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
};

// System backup status query
export const useBackupStatus = () => {
  return useQuery({
    queryKey: ['system', 'backup', 'status'],
    queryFn: async () => {
      const response = await SystemAPI.getBackupStatus();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch backup status');
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

// Create backup mutation
export const useCreateBackup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await SystemAPI.createBackup();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to create backup');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'backup'] });
    },
  });
};

// Restore backup mutation
export const useRestoreBackup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (backupId: string) => {
      const response = await SystemAPI.restoreBackup(backupId);
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to restore backup');
    },
    onSuccess: () => {
      // Invalidate all system queries after restore
      queryClient.invalidateQueries({ queryKey: ['system'] });
    },
  });
};

// System performance profile query
export const useSystemPerformance = () => {
  return useQuery({
    queryKey: ['system', 'performance'],
    queryFn: async () => {
      const response = await SystemAPI.getPerformanceProfile();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch performance profile');
    },
    refetchInterval: 15000, // Update every 15 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
};

// Real-time metrics hook
export const useRealtimeMetrics = () => {
  const { startMetricsSubscription, stopMetricsSubscription, isConnected } = useSystemStore();

  useEffect(() => {
    startMetricsSubscription();

    return () => {
      stopMetricsSubscription();
    };
  }, [startMetricsSubscription, stopMetricsSubscription]);

  return { isConnected };
};

// Real-time alerts hook
export const useRealtimeAlerts = () => {
  const { startAlertsSubscription, stopAlertsSubscription } = useSystemStore();

  useEffect(() => {
    startAlertsSubscription();

    return () => {
      stopAlertsSubscription();
    };
  }, [startAlertsSubscription, stopAlertsSubscription]);

  return {};
};

// System restart mutation
export const useRestartSystem = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await SystemAPI.restart();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to restart system');
    },
  });
};

// System shutdown mutation
export const useShutdownSystem = () => {
  return useMutation({
    mutationFn: async () => {
      const response = await SystemAPI.shutdown();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to shutdown system');
    },
  });
};

// System info query
export const useSystemInfo = () => {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: async () => {
      const response = await SystemAPI.getInfo();
      if (response.success) {
        return response.data!;
      }
      throw new Error(response.error?.message || 'Failed to fetch system info');
    },
    staleTime: 300000, // Consider data stale after 5 minutes
  });
};
