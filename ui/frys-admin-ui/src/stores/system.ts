import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { SystemStatus, SystemMetrics, Alert } from '@/types';

interface SystemState {
  // State
  status: SystemStatus | null;
  metrics: SystemMetrics | null;
  alerts: Alert[];
  isConnected: boolean;
  lastUpdate: string | null;

  // Real-time subscriptions
  metricsSubscription: WebSocket | null;
  alertsSubscription: WebSocket | null;

  // Actions
  setStatus: (status: SystemStatus) => void;
  setMetrics: (metrics: SystemMetrics) => void;
  addAlert: (alert: Alert) => void;
  updateAlert: (alertId: string, updates: Partial<Alert>) => void;
  removeAlert: (alertId: string) => void;
  setConnected: (connected: boolean) => void;
  setLastUpdate: (timestamp: string) => void;

  // Real-time management
  startMetricsSubscription: () => void;
  stopMetricsSubscription: () => void;
  startAlertsSubscription: () => void;
  stopAlertsSubscription: () => void;

  // Computed values
  getActiveAlertsCount: () => number;
  getCriticalAlertsCount: () => number;
  getSystemHealthScore: () => number;
  getRecentAlerts: (limit?: number) => Alert[];
}

export const useSystemStore = create<SystemState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: null,
    metrics: null,
    alerts: [],
    isConnected: false,
    lastUpdate: null,

    // Subscriptions
    metricsSubscription: null,
    alertsSubscription: null,

    // Actions
    setStatus: (status: SystemStatus) => {
      set({ status, lastUpdate: new Date().toISOString() });
    },

    setMetrics: (metrics: SystemMetrics) => {
      set({ metrics, lastUpdate: new Date().toISOString() });
    },

    addAlert: (alert: Alert) => {
      set((state) => ({
        alerts: [alert, ...state.alerts].slice(0, 1000), // Keep last 1000 alerts
      }));
    },

    updateAlert: (alertId: string, updates: Partial<Alert>) => {
      set((state) => ({
        alerts: state.alerts.map((alert) =>
          alert.id === alertId ? { ...alert, ...updates } : alert
        ),
      }));
    },

    removeAlert: (alertId: string) => {
      set((state) => ({
        alerts: state.alerts.filter((alert) => alert.id !== alertId),
      }));
    },

    setConnected: (connected: boolean) => {
      set({ isConnected: connected });
    },

    setLastUpdate: (timestamp: string) => {
      set({ lastUpdate: timestamp });
    },

    // Real-time subscriptions
    startMetricsSubscription: () => {
      const state = get();

      // Clean up existing subscription
      if (state.metricsSubscription) {
        state.metricsSubscription.close();
      }

      try {
        // This would connect to the actual WebSocket API
        // For now, we'll use a mock implementation
        const ws = new WebSocket('ws://localhost:8080/ws/system/metrics');

        ws.onopen = () => {
          console.log('Connected to metrics stream');
          set({ isConnected: true });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'metrics') {
              set({ metrics: data.payload, lastUpdate: new Date().toISOString() });
            }
          } catch (error) {
            console.error('Failed to parse metrics data:', error);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from metrics stream');
          set({ isConnected: false });
        };

        ws.onerror = (error) => {
          console.error('Metrics stream error:', error);
          set({ isConnected: false });
        };

        set({ metricsSubscription: ws });
      } catch (error) {
        console.error('Failed to start metrics subscription:', error);
      }
    },

    stopMetricsSubscription: () => {
      const state = get();
      if (state.metricsSubscription) {
        state.metricsSubscription.close();
        set({ metricsSubscription: null, isConnected: false });
      }
    },

    startAlertsSubscription: () => {
      const state = get();

      // Clean up existing subscription
      if (state.alertsSubscription) {
        state.alertsSubscription.close();
      }

      try {
        const ws = new WebSocket('ws://localhost:8080/ws/system/alerts');

        ws.onopen = () => {
          console.log('Connected to alerts stream');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_alert') {
              get().addAlert(data.payload);
            } else if (data.type === 'update_alert') {
              get().updateAlert(data.payload.id, data.payload);
            }
          } catch (error) {
            console.error('Failed to parse alert data:', error);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from alerts stream');
        };

        ws.onerror = (error) => {
          console.error('Alerts stream error:', error);
        };

        set({ alertsSubscription: ws });
      } catch (error) {
        console.error('Failed to start alerts subscription:', error);
      }
    },

    stopAlertsSubscription: () => {
      const state = get();
      if (state.alertsSubscription) {
        state.alertsSubscription.close();
        set({ alertsSubscription: null });
      }
    },

    // Computed values
    getActiveAlertsCount: () => {
      const state = get();
      return state.alerts.filter((alert) => !alert.resolved).length;
    },

    getCriticalAlertsCount: () => {
      const state = get();
      return state.alerts.filter((alert) => alert.severity === 'critical' && !alert.resolved).length;
    },

    getSystemHealthScore: () => {
      const state = get();
      if (!state.status || !state.metrics) return 0;

      let score = 100;

      // CPU usage penalty
      if (state.metrics.cpu.usage > 90) score -= 30;
      else if (state.metrics.cpu.usage > 70) score -= 15;

      // Memory usage penalty
      if (state.metrics.memory.usage > 90) score -= 30;
      else if (state.metrics.memory.usage > 70) score -= 15;

      // Disk usage penalty
      if (state.metrics.disk.usage > 95) score -= 20;
      else if (state.metrics.disk.usage > 80) score -= 10;

      // Active alerts penalty
      const activeAlerts = state.alerts.filter((alert) => !alert.resolved).length;
      score -= Math.min(activeAlerts * 5, 20);

      return Math.max(0, score);
    },

    getRecentAlerts: (limit: number = 10) => {
      const state = get();
      return state.alerts.slice(0, limit);
    },
  }))
);

// Selectors for common system queries
export const useSystemSelectors = () => {
  const store = useSystemStore();

  return {
    isSystemHealthy: store.status?.status === 'healthy',
    isSystemDegraded: store.status?.status === 'degraded',
    isSystemUnhealthy: store.status?.status === 'unhealthy',

    cpuUsage: store.metrics?.cpu.usage || 0,
    memoryUsage: store.metrics?.memory.usage || 0,
    diskUsage: store.metrics?.disk.usage || 0,

    activeAlertsCount: store.getActiveAlertsCount(),
    criticalAlertsCount: store.getCriticalAlertsCount(),
    systemHealthScore: store.getSystemHealthScore(),

    recentAlerts: store.getRecentAlerts(),
    highPriorityAlerts: store.alerts.filter(
      (alert) => (alert.severity === 'high' || alert.severity === 'critical') && !alert.resolved
    ),

    uptime: store.status?.uptime || 0,
    version: store.status?.version || 'unknown',
  };
};
