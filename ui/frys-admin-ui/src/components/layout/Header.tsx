import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Bars3Icon,
  BellIcon,
  CogIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, useAuthSelectors } from '@/stores/auth';
import { useSystemSelectors } from '@/stores/system';

interface HeaderProps {
  title?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  breadcrumbs = [],
  onMenuClick,
}) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isAdmin } = useAuthSelectors();
  const { activeAlertsCount, criticalAlertsCount } = useSystemSelectors();

  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);

  React.useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('frys-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // Default to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('frys-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Menu button and breadcrumbs */}
          <div className="flex items-center">
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300"
              onClick={onMenuClick}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden lg:flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-4">
                <li>
                  <div className="flex">
                    <Link
                      href="/dashboard"
                      className="text-neutral-400 hover:text-neutral-500 dark:text-neutral-500 dark:hover:text-neutral-400"
                    >
                      首页
                    </Link>
                  </div>
                </li>
                {breadcrumbs.map((crumb, index) => (
                  <li key={index}>
                    <div className="flex items-center">
                      <svg
                        className="flex-shrink-0 h-5 w-5 text-neutral-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          className="ml-4 text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="ml-4 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {crumb.label}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Mobile title */}
            {title && (
              <h1 className="lg:hidden ml-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h1>
            )}
          </div>

          {/* Right side - Notifications, theme toggle, user menu */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                className="relative p-1 text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <BellIcon className="h-6 w-6" />
                {(activeAlertsCount > 0 || criticalAlertsCount > 0) && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      {criticalAlertsCount > 0 ? '!' : activeAlertsCount}
                    </span>
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {showNotifications && (
                <div className="absolute right-0 z-10 mt-2 w-80 origin-top-right bg-white dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        通知中心
                      </h3>
                      <button
                        type="button"
                        className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
                        onClick={() => router.push('/monitoring/alerts')}
                      >
                        查看全部
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {criticalAlertsCount > 0 && (
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-2 w-2 bg-red-500 rounded-full mt-2"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-900 dark:text-neutral-100">
                              {criticalAlertsCount} 个紧急告警需要处理
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              点击查看详情
                            </p>
                          </div>
                        </div>
                      )}

                      {activeAlertsCount > 0 && criticalAlertsCount === 0 && (
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-2 w-2 bg-yellow-500 rounded-full mt-2"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-900 dark:text-neutral-100">
                              {activeAlertsCount} 个活动告警
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              系统运行正常
                            </p>
                          </div>
                        </div>
                      )}

                      {activeAlertsCount === 0 && (
                        <div className="text-center py-4">
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            暂无新通知
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              type="button"
              className="p-1 text-neutral-400 hover:text-neutral-500 dark:hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <MoonIcon className="h-6 w-6" />
              ) : (
                <SunIcon className="h-6 w-6" />
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center max-w-xs bg-white dark:bg-neutral-800 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="hidden md:block ml-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {user?.fullName || user?.username}
                  </span>
                </div>
              </button>

              {/* User menu dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right bg-white dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {user?.fullName || user?.username}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {user?.email}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                        {user?.role}
                      </p>
                    </div>

                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <div className="flex items-center">
                        <UserCircleIcon className="mr-2 h-4 w-4" />
                        个人资料
                      </div>
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/system/config"
                        className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <div className="flex items-center">
                          <CogIcon className="mr-2 h-4 w-4" />
                          系统设置
                        </div>
                      </Link>
                    )}

                    <button
                      type="button"
                      className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      onClick={handleLogout}
                    >
                      <div className="flex items-center">
                        <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                        退出登录
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
