import React from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          {/* Left side - Copyright and version */}
          <div className="flex items-center space-x-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span>© {currentYear} Frys Team. All rights reserved.</span>
            <span className="hidden sm:inline">•</span>
            <span>v1.0.0</span>
          </div>

          {/* Center - Links */}
          <div className="flex items-center space-x-6 text-sm">
            <a
              href="https://github.com/frys/frys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              GitHub
            </a>
            <a
              href="/docs"
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              文档
            </a>
            <a
              href="/api/docs"
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              API
            </a>
            <a
              href="/support"
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              支持
            </a>
          </div>

          {/* Right side - Made with love */}
          <div className="flex items-center space-x-1 text-sm text-neutral-500 dark:text-neutral-400">
            <span>Made with</span>
            <HeartIcon className="h-4 w-4 text-red-500" />
            <span>by Frys Team</span>
          </div>
        </div>

        {/* Additional info for mobile */}
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 sm:hidden">
          <div className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
            基于 Rust 微内核架构 • 高性能分布式工作流系统
          </div>
        </div>
      </div>
    </footer>
  );
};
