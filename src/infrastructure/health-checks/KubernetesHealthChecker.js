/**
 * frys - Kubernetes健康检查器
 * 专门为Kubernetes环境优化的健康检查实现
 */

import { HealthChecker } from './HealthChecker.js';
import { logger } from '../../utils/logger.js';
import { run_terminal_cmd } from '../../utils/terminal.js';

export class KubernetesHealthChecker extends HealthChecker {
  constructor(config = {}) {
    super(config);

    this.namespace = config.namespace || 'default';
    this.podName = config.podName || process.env.POD_NAME;
    this.serviceName =
      config.serviceName || process.env.SERVICE_NAME || 'frys-app';
    this.clusterName = config.clusterName || process.env.CLUSTER_NAME;
    this.kubeconfig = config.kubeconfig || process.env.KUBECONFIG;

    // Kubernetes特定的配置
    this.readinessProbe = config.readinessProbe;
    this.livenessProbe = config.livenessProbe;
    this.startupProbe = config.startupProbe;

    // 注册Kubernetes特定的健康检查
    this._registerKubernetesChecks();
  }

  /**
   * 注册Kubernetes特定的健康检查
   */
  _registerKubernetesChecks() {
    // Pod自身健康检查
    this.registerCheck('pod_self', {
      check: this._checkPodSelf.bind(this),
      critical: true,
      interval: 10000, // 10秒
    });

    // Kubernetes API服务器连接检查
    this.registerCheck('kube_api', {
      check: this._checkKubeApi.bind(this),
      critical: true,
      interval: 30000, // 30秒
    });

    // 集群组件健康检查
    this.registerCheck('cluster_components', {
      check: this._checkClusterComponents.bind(this),
      critical: false,
      interval: 60000, // 1分钟
    });

    // 服务发现检查
    this.registerCheck('service_discovery', {
      check: this._checkServiceDiscovery.bind(this),
      critical: false,
      interval: 30000,
    });

    // ConfigMap和Secret检查
    this.registerCheck('config_resources', {
      check: this._checkConfigResources.bind(this),
      critical: false,
      interval: 120000, // 2分钟
    });

    // 网络策略检查
    this.registerCheck('network_policies', {
      check: this._checkNetworkPolicies.bind(this),
      critical: false,
      interval: 300000, // 5分钟
    });
  }

  /**
   * 检查Pod自身健康状态
   */
  async _checkPodSelf() {
    try {
      const podInfo = await this._getPodInfo();

      // 检查Pod状态
      if (podInfo.status.phase !== 'Running') {
        throw new Error(`Pod is not running: ${podInfo.status.phase}`);
      }

      // 检查容器状态
      const containers = podInfo.status.containerStatuses || [];
      for (const container of containers) {
        if (!container.ready) {
          throw new Error(`Container ${container.name} is not ready`);
        }

        if (container.state.waiting) {
          throw new Error(
            `Container ${container.name} is waiting: ${container.state.waiting.reason}`,
          );
        }

        if (container.state.terminated) {
          throw new Error(
            `Container ${container.name} terminated: ${container.state.terminated.reason}`,
          );
        }

        // 检查重启次数
        if (container.restartCount > 5) {
          throw new Error(
            `Container ${container.name} has restarted ${container.restartCount} times`,
          );
        }
      }

      // 检查探针状态
      if (podInfo.spec.containers) {
        for (const container of podInfo.spec.containers) {
          if (container.livenessProbe) {
            await this._checkProbe('liveness', container.livenessProbe);
          }
          if (container.readinessProbe) {
            await this._checkProbe('readiness', container.readinessProbe);
          }
        }
      }

      return {
        phase: podInfo.status.phase,
        containers: containers.map((c) => ({
          name: c.name,
          ready: c.ready,
          restartCount: c.restartCount,
          state: c.state,
        })),
        conditions: podInfo.status.conditions || [],
      };
    } catch (error) {
      throw new Error(`Pod self-check failed: ${error.message}`);
    }
  }

  /**
   * 检查探针状态
   */
  async _checkProbe(type, probe) {
    // 简化的探针检查实现
    // 实际应该调用Kubernetes API来获取探针执行结果
    if (probe.httpGet) {
      const url = `http://${probe.httpGet.host || 'localhost'}:${probe.httpGet.port}${probe.httpGet.path}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          (probe.timeoutSeconds || 1) * 1000,
        );

        const response = await fetch(url, {
          method: probe.httpGet.method || 'GET',
          headers: probe.httpGet.httpHeaders || {},
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`${type} probe failed: HTTP ${response.status}`);
        }
      } catch (error) {
        throw new Error(`${type} probe failed: ${error.message}`);
      }
    }
  }

  /**
   * 检查Kubernetes API服务器连接
   */
  async _checkKubeApi() {
    try {
      // 检查kubectl连接
      const result = await run_terminal_cmd({
        command: `kubectl version --short --client`,
        is_background: false,
        explanation: '检查kubectl客户端版本',
      });

      if (result.code !== 0) {
        throw new Error(`kubectl check failed: ${result.stderr}`);
      }

      // 检查API服务器连接
      const apiResult = await run_terminal_cmd({
        command: `kubectl cluster-info`,
        is_background: false,
        explanation: '检查Kubernetes集群连接',
      });

      if (apiResult.code !== 0) {
        throw new Error(`Kubernetes API check failed: ${apiResult.stderr}`);
      }

      // 获取集群版本
      const versionResult = await run_terminal_cmd({
        command: `kubectl version --short`,
        is_background: false,
        explanation: '获取Kubernetes版本信息',
      });

      const version = this._parseVersionInfo(versionResult.stdout);

      return {
        clientVersion: version.client,
        serverVersion: version.server,
        connected: true,
      };
    } catch (error) {
      throw new Error(`Kubernetes API connection failed: ${error.message}`);
    }
  }

  /**
   * 解析版本信息
   */
  _parseVersionInfo(versionOutput) {
    const lines = versionOutput.trim().split('\n');
    const version = {};

    for (const line of lines) {
      if (line.includes('Client Version:')) {
        version.client = line.split(':')[1].trim();
      } else if (line.includes('Server Version:')) {
        version.server = line.split(':')[1].trim();
      }
    }

    return version;
  }

  /**
   * 检查集群组件健康状态
   */
  async _checkClusterComponents() {
    const components = [];
    const issues = [];

    try {
      // 检查核心组件状态
      const coreComponents = [
        'etcd',
        'kube-apiserver',
        'kube-controller-manager',
        'kube-scheduler',
        'kube-proxy',
        'kubelet',
      ];

      for (const component of coreComponents) {
        try {
          const result = await run_terminal_cmd({
            command: `kubectl get componentstatus ${component}`,
            is_background: false,
            explanation: `检查组件 ${component} 状态`,
          });

          if (result.code === 0) {
            components.push({ name: component, status: 'healthy' });
          } else {
            issues.push(`${component}: ${result.stderr}`);
            components.push({
              name: component,
              status: 'unhealthy',
              error: result.stderr,
            });
          }
        } catch (error) {
          issues.push(`${component}: ${error.message}`);
          components.push({
            name: component,
            status: 'unknown',
            error: error.message,
          });
        }
      }

      // 检查节点状态
      const nodesResult = await run_terminal_cmd({
        command: `kubectl get nodes --no-headers`,
        is_background: false,
        explanation: '检查集群节点状态',
      });

      const nodeLines = nodesResult.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const nodeStats = { total: nodeLines.length, ready: 0, notReady: 0 };

      for (const line of nodeLines) {
        const parts = line.split(/\s+/);
        const status = parts[1];
        if (status === 'Ready') {
          nodeStats.ready++;
        } else {
          nodeStats.notReady++;
        }
      }

      components.push({
        name: 'nodes',
        status: nodeStats.notReady === 0 ? 'healthy' : 'degraded',
        details: nodeStats,
      });

      if (issues.length > 0) {
        throw new Error(`Cluster component issues: ${issues.join('; ')}`);
      }

      return { components, nodeStats };
    } catch (error) {
      throw new Error(`Cluster components check failed: ${error.message}`);
    }
  }

  /**
   * 检查服务发现
   */
  async _checkServiceDiscovery() {
    try {
      const services = [];

      // 检查当前服务的Endpoints
      const endpointsResult = await run_terminal_cmd({
        command: `kubectl get endpoints ${this.serviceName} -n ${this.namespace} -o json`,
        is_background: false,
        explanation: '检查服务端点',
      });

      if (endpointsResult.code === 0) {
        const endpoints = JSON.parse(endpointsResult.stdout);
        const subsets = endpoints.subsets || [];

        let totalEndpoints = 0;
        for (const subset of subsets) {
          totalEndpoints += subset.addresses?.length || 0;
        }

        services.push({
          name: this.serviceName,
          endpoints: totalEndpoints,
          status: totalEndpoints > 0 ? 'healthy' : 'no_endpoints',
        });

        if (totalEndpoints === 0) {
          throw new Error(`Service ${this.serviceName} has no endpoints`);
        }
      }

      // 检查DNS解析
      try {
        const dns = await import('dns/promises');
        await dns.lookup(
          `${this.serviceName}.${this.namespace}.svc.cluster.local`,
        );
        services.push({
          name: 'dns_resolution',
          status: 'healthy',
        });
      } catch (error) {
        services.push({
          name: 'dns_resolution',
          status: 'failed',
          error: error.message,
        });
        throw new Error(`DNS resolution failed: ${error.message}`);
      }

      return { services };
    } catch (error) {
      throw new Error(`Service discovery check failed: ${error.message}`);
    }
  }

  /**
   * 检查配置资源
   */
  async _checkConfigResources() {
    try {
      const resources = [];

      // 检查ConfigMaps
      try {
        const cmResult = await run_terminal_cmd({
          command: `kubectl get configmaps -n ${this.namespace} -o name`,
          is_background: false,
          explanation: '检查ConfigMaps',
        });

        const configMaps = cmResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;
        resources.push({
          type: 'configmap',
          count: configMaps,
          status: 'available',
        });
      } catch (error) {
        resources.push({
          type: 'configmap',
          status: 'error',
          error: error.message,
        });
      }

      // 检查Secrets
      try {
        const secretResult = await run_terminal_cmd({
          command: `kubectl get secrets -n ${this.namespace} -o name`,
          is_background: false,
          explanation: '检查Secrets',
        });

        const secrets = secretResult.stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim()).length;
        resources.push({
          type: 'secret',
          count: secrets,
          status: 'available',
        });
      } catch (error) {
        resources.push({
          type: 'secret',
          status: 'error',
          error: error.message,
        });
      }

      // 检查当前Pod使用的配置
      if (this.podName) {
        try {
          const volumes = await this._getPodVolumes();
          resources.push({
            type: 'pod_volumes',
            volumes: volumes,
            status: 'mounted',
          });
        } catch (error) {
          resources.push({
            type: 'pod_volumes',
            status: 'error',
            error: error.message,
          });
        }
      }

      return { resources };
    } catch (error) {
      throw new Error(`Config resources check failed: ${error.message}`);
    }
  }

  /**
   * 检查网络策略
   */
  async _checkNetworkPolicies() {
    try {
      const policies = [];

      // 检查NetworkPolicy
      const npResult = await run_terminal_cmd({
        command: `kubectl get networkpolicies -n ${this.namespace} -o name`,
        is_background: false,
        explanation: '检查网络策略',
      });

      const networkPolicies = npResult.stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      policies.push({
        type: 'network_policy',
        count: networkPolicies.length,
        policies: networkPolicies.map((np) =>
          np.replace('networkpolicy.networking.k8s.io/', ''),
        ),
      });

      // 检查Pod网络连接
      if (this.podName) {
        try {
          // 尝试连接到Kubernetes DNS
          const dns = await import('dns/promises');
          await dns.lookup('kubernetes.default.svc.cluster.local');

          policies.push({
            type: 'pod_network',
            status: 'connected',
            dns_resolution: true,
          });
        } catch (error) {
          policies.push({
            type: 'pod_network',
            status: 'dns_failed',
            error: error.message,
          });
          throw new Error(`Pod network check failed: ${error.message}`);
        }
      }

      return { policies };
    } catch (error) {
      throw new Error(`Network policies check failed: ${error.message}`);
    }
  }

  /**
   * 获取Pod信息
   */
  async _getPodInfo() {
    try {
      const result = await run_terminal_cmd({
        command: `kubectl get pod ${this.podName} -n ${this.namespace} -o json`,
        is_background: false,
        explanation: '获取Pod信息',
      });

      if (result.code !== 0) {
        throw new Error(`Failed to get pod info: ${result.stderr}`);
      }

      return JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(`Pod info retrieval failed: ${error.message}`);
    }
  }

  /**
   * 获取Pod卷信息
   */
  async _getPodVolumes() {
    const podInfo = await this._getPodInfo();
    const volumes = [];

    if (podInfo.spec.volumes) {
      for (const volume of podInfo.spec.volumes) {
        volumes.push({
          name: volume.name,
          type: Object.keys(volume).find((key) => key !== 'name'),
          mounted: true,
        });
      }
    }

    return volumes;
  }

  /**
   * 获取Kubernetes环境信息
   */
  async getKubernetesEnvironmentInfo() {
    try {
      const podInfo = await this._getPodInfo();
      const clusterInfo = await this._getClusterInfo();

      return {
        pod: {
          name: podInfo.metadata.name,
          namespace: podInfo.metadata.namespace,
          nodeName: podInfo.spec.nodeName,
          serviceAccount: podInfo.spec.serviceAccountName,
          containers: podInfo.spec.containers.map((c) => ({
            name: c.name,
            image: c.image,
            ports: c.ports || [],
          })),
          volumes: podInfo.spec.volumes || [],
        },
        cluster: clusterInfo,
        status: podInfo.status,
      };
    } catch (error) {
      logger.error('获取Kubernetes环境信息失败', error);
      return null;
    }
  }

  /**
   * 获取集群信息
   */
  async _getClusterInfo() {
    try {
      const clusterResult = await run_terminal_cmd({
        command: `kubectl cluster-info dump | head -20`,
        is_background: false,
        explanation: '获取集群信息',
      });

      return {
        connected: true,
        info: clusterResult.stdout,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * 执行Pod重启
   */
  async restartPod(reason = 'health_check_failed') {
    try {
      logger.warn('执行Pod重启', {
        reason,
        pod: this.podName,
        namespace: this.namespace,
      });

      const result = await run_terminal_cmd({
        command: `kubectl delete pod ${this.podName} -n ${this.namespace}`,
        is_background: false,
        explanation: '删除Pod以触发重启',
      });

      if (result.code !== 0) {
        throw new Error(`Pod restart failed: ${result.stderr}`);
      }

      logger.info('Pod重启已触发', { pod: this.podName });
      return true;
    } catch (error) {
      logger.error('Pod重启失败', { error: error.message, pod: this.podName });
      throw error;
    }
  }

  /**
   * 获取Pod日志
   */
  async getPodLogs(container = '', lines = 50, since = '') {
    try {
      let command = `kubectl logs ${this.podName} -n ${this.namespace} --tail=${lines}`;

      if (container) {
        command += ` -c ${container}`;
      }

      if (since) {
        command += ` --since=${since}`;
      }

      const result = await run_terminal_cmd({
        command,
        is_background: false,
        explanation: '获取Pod日志',
      });

      if (result.code !== 0) {
        throw new Error(`Failed to get pod logs: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      logger.error('获取Pod日志失败', { error: error.message });
      return null;
    }
  }

  /**
   * 执行集群诊断
   */
  async runClusterDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      checks: [],
    };

    try {
      // 检查节点状态
      diagnostics.checks.push(await this._diagnoseNodes());

      // 检查Pod状态
      diagnostics.checks.push(await this._diagnosePods());

      // 检查服务状态
      diagnostics.checks.push(await this._diagnoseServices());

      // 检查资源使用
      diagnostics.checks.push(await this._diagnoseResourceUsage());

      diagnostics.status = 'completed';
    } catch (error) {
      diagnostics.status = 'failed';
      diagnostics.error = error.message;
    }

    return diagnostics;
  }

  async _diagnoseNodes() {
    try {
      const result = await run_terminal_cmd({
        command: `kubectl get nodes -o wide`,
        is_background: false,
        explanation: '诊断节点状态',
      });

      return {
        component: 'nodes',
        status: 'checked',
        output: result.stdout,
      };
    } catch (error) {
      return {
        component: 'nodes',
        status: 'failed',
        error: error.message,
      };
    }
  }

  async _diagnosePods() {
    try {
      const result = await run_terminal_cmd({
        command: `kubectl get pods -n ${this.namespace} -o wide`,
        is_background: false,
        explanation: '诊断Pod状态',
      });

      return {
        component: 'pods',
        status: 'checked',
        output: result.stdout,
      };
    } catch (error) {
      return {
        component: 'pods',
        status: 'failed',
        error: error.message,
      };
    }
  }

  async _diagnoseServices() {
    try {
      const result = await run_terminal_cmd({
        command: `kubectl get services -n ${this.namespace}`,
        is_background: false,
        explanation: '诊断服务状态',
      });

      return {
        component: 'services',
        status: 'checked',
        output: result.stdout,
      };
    } catch (error) {
      return {
        component: 'services',
        status: 'failed',
        error: error.message,
      };
    }
  }

  async _diagnoseResourceUsage() {
    try {
      const result = await run_terminal_cmd({
        command: `kubectl top nodes && echo "--- PODS ---" && kubectl top pods -n ${this.namespace}`,
        is_background: false,
        explanation: '诊断资源使用',
      });

      return {
        component: 'resource_usage',
        status: 'checked',
        output: result.stdout,
      };
    } catch (error) {
      return {
        component: 'resource_usage',
        status: 'failed',
        error: error.message,
      };
    }
  }
}
