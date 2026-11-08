import React, { useState } from 'react';
import { AdminLayout, AdminTab } from './AdminLayout';
import { AdminOverview } from './AdminOverview';
import { AdminProducts } from './AdminProducts';
import { AdminInventory } from './AdminInventory';
import { AdminCategories } from './AdminCategories';
import { AdminSuppliers } from './AdminSuppliers';
import { AdminOffers } from './AdminOffers';
import { AdminOrders } from './AdminOrders';
import { AdminSales } from './AdminSales';
import { AdminCustomers } from './AdminCustomers';
import { AdminLoginActivity } from './AdminLoginActivity';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminActivityLog } from './AdminActivityLog';
import { AdminSettings } from './AdminSettings';

interface AdminDashboardProps {
  initialTab?: AdminTab;
  onExitToStore: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialTab = 'overview',
  onExitToStore,
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(initialTab);

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return <AdminOverview onNavigate={setCurrentTab} />;
      case 'products':
        return <AdminProducts />;
      case 'inventory':
        return <AdminInventory />;
      case 'categories':
        return <AdminCategories onNavigate={setCurrentTab} />;
      case 'suppliers':
        return <AdminSuppliers />;
      case 'offers':
        return <AdminOffers />;
      case 'orders':
        return <AdminOrders />;
      case 'sales':
        return <AdminSales />;
      case 'customers':
        return <AdminCustomers />;
      case 'logins':
        return <AdminLoginActivity />;
      case 'analytics':
        return <AdminAnalytics />;
      case 'activity':
        return <AdminActivityLog />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminOverview onNavigate={setCurrentTab} />;
    }
  };

  return (
    <AdminLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      onExitToStore={onExitToStore}
    >
      {renderContent()}
    </AdminLayout>
  );
};

