import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  CogIcon,
  ChartBarIcon,
  CubeIcon,
  DocumentTextIcon,
  UsersIcon,
  ShieldCheckIcon,
  ServerIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useAuthSelectors } from '@/stores/auth';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  {
    name: '仪表板',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    name: '工作流',
    href: '/workflows',
    icon: DocumentTextIcon,
    children: [
      {
        name: '定义管理',
        href: '/workflows/definitions',
        icon: DocumentTextIcon,
      },
      {
        name: '实例监控',
        href: '/workflows/instances',
        icon: ChartBarIcon,
      },
      {
        name: '工作流设计器',
        href: '/workflows/designer',
        icon: WrenchScrewdriverIcon,
      },
    ],
  },
  {
    name: 'AI 系统',
    href: '/ai',
    icon: CpuChipIcon,
    children: [
      {
        name: '模型管理',
        href: '/ai/models',
        icon: CubeIcon,
      },
      {
        name: '推理服务',
        href: '/ai/inference',
        icon: BeakerIcon,
      },
      {
        name: '性能监控',
        href: '/ai/metrics',
        icon: ChartBarIcon,
      },
    ],
  },
  {
    name: '插件系统',
    href: '/plugins',
    icon: WrenchScrewdriverIcon,
    permission: 'plugins.manage',
  },
  {
    name: '系统监控',
    href: '/monitoring',
    icon: ChartBarIcon,
    children: [
      {
        name: '概览',
        href: '/monitoring/overview',
        icon: HomeIcon,
      },
      {
        name: '告警中心',
        href: '/monitoring/alerts',
        icon: ShieldCheckIcon,
      },
      {
        name: '性能指标',
        href: '/monitoring/metrics',
        icon: ChartBarIcon,
      },
      {
        name: '日志分析',
        href: '/monitoring/logs',
        icon: DocumentTextIcon,
      },
    ],
  },
  {
    name: '系统管理',
    href: '/system',
    icon: ServerIcon,
    permission: 'system.manage',
    children: [
      {
        name: '配置管理',
        href: '/system/config',
        icon: CogIcon,
      },
      {
        name: '用户管理',
        href: '/system/users',
        icon: UsersIcon,
        permission: 'users.manage',
      },
      {
        name: '安全设置',
        href: '/system/security',
        icon: ShieldCheckIcon,
        permission: 'system.manage',
      },
      {
        name: '备份恢复',
        href: '/system/backup',
        icon: ServerIcon,
        permission: 'system.manage',
      },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const router = useRouter();
  const { canViewWorkflows, canManageSystem, canManageUsers, canManagePlugins } = useAuthSelectors();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return router.pathname === '/dashboard' || router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;

    switch (permission) {
      case 'plugins.manage':
        return canManagePlugins;
      case 'system.manage':
        return canManageSystem;
      case 'users.manage':
        return canManageUsers;
      default:
        return true;
    }
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    if (!hasPermission(item.permission)) {
      return null;
    }

    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const [expanded, setExpanded] = React.useState(active);

    return (
      <div key={item.name}>
        <Link
          href={item.href}
          className={`
            group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
            ${active
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
              : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            }
            ${level > 0 ? 'ml-4' : ''}
          `}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              setExpanded(!expanded);
            } else {
              onClose();
            }
          }}
        >
          <item.icon
            className={`
              mr-3 flex-shrink-0 h-5 w-5 transition-colors
              ${active
                ? 'text-primary-500 dark:text-primary-400'
                : 'text-neutral-400 group-hover:text-neutral-500 dark:group-hover:text-neutral-300'
              }
            `}
          />
          {item.name}
          {hasChildren && (
            <svg
              className={`ml-auto h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </Link>

        {hasChildren && expanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Frys Admin
                </h1>
              </div>
            </div>
          </div>

          <nav className="mt-8 flex-1 px-2 space-y-1">
            {navigation.map((item) => renderNavigationItem(item))}
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Frys Admin
              </h1>
            </div>
          </div>
        </div>

        <nav className="mt-8 flex-1 px-2 space-y-1 overflow-y-auto">
          {navigation.map((item) => renderNavigationItem(item))}
        </nav>
      </div>
    </>
  );
};
