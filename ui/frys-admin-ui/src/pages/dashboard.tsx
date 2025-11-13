import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { SystemHealthCard } from '@/components/dashboard/SystemHealthCard';
import { RecentWorkflowsCard } from '@/components/dashboard/RecentWorkflowsCard';
import { AlertsCard } from '@/components/dashboard/AlertsCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

const DashboardPage: React.FC = () => {
  const breadcrumbs = [
    { label: '仪表板' },
  ];

  return (
    <Layout title="仪表板" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Key Metrics */}
        <DashboardStats />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* System Health */}
            <SystemHealthCard />

            {/* Performance Chart */}
            <PerformanceChart />

            {/* Recent Workflows */}
            <RecentWorkflowsCard />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Alerts */}
            <AlertsCard />

            {/* Activity Feed */}
            <ActivityFeed />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
