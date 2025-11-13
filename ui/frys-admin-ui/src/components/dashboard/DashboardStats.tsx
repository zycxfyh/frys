import React from 'react';
import {
  CubeIcon,
  DocumentTextIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useWorkflowSelectors } from '@/stores/workflow';
import { useSystemSelectors } from '@/stores/system';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  };

  return (
    <div className="bg-white dark:bg-neutral-800 overflow-hidden shadow-sm rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${colorClasses[color]}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {change && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    change.type === 'increase'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    <svg
                      className={`self-center flex-shrink-0 h-4 w-4 ${
                        change.type === 'increase' ? 'text-green-500' : 'text-red-500'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d={change.type === 'increase'
                          ? "M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                          : "M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 110-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                        }
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="ml-1">
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardStats: React.FC = () => {
  const workflowStats = useWorkflowSelectors().instanceStats;
  const { systemHealthScore, cpuUsage, memoryUsage } = useSystemSelectors();

  const stats = [
    {
      title: '工作流定义',
      value: 24, // TODO: Get from API
      change: { value: 12, type: 'increase' as const },
      icon: DocumentTextIcon,
      color: 'blue' as const,
    },
    {
      title: '运行中的工作流',
      value: workflowStats.running,
      icon: PlayIcon,
      color: 'green' as const,
    },
    {
      title: '已完成的工作流',
      value: workflowStats.completed,
      change: { value: 8, type: 'increase' as const },
      icon: CheckCircleIcon,
      color: 'purple' as const,
    },
    {
      title: '失败的工作流',
      value: workflowStats.failed,
      change: { value: -5, type: 'decrease' as const },
      icon: ExclamationTriangleIcon,
      color: 'red' as const,
    },
    {
      title: '系统健康度',
      value: `${systemHealthScore}%`,
      icon: CpuChipIcon,
      color: systemHealthScore >= 90 ? 'green' : systemHealthScore >= 70 ? 'yellow' : 'red' as const,
    },
    {
      title: 'CPU 使用率',
      value: `${cpuUsage.toFixed(1)}%`,
      icon: CpuChipIcon,
      color: cpuUsage < 70 ? 'green' : cpuUsage < 85 ? 'yellow' : 'red' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};
