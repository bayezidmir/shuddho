import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { StoreHeader } from './components/store/Header';
import { CartDrawer } from './components/store/CartDrawer';
import { StoreFooter } from './components/store/Footer';
import { StoreOverlays } from './components/store/StoreOverlays';

import { HomePage } from './pages/store/HomePage';
import { ShopPage } from './pages/store/ShopPage';
import { ProductPage } from './pages/store/ProductPage';
import { CartPage } from './pages/store/CartPage';
import { CheckoutPage } from './pages/store/CheckoutPage';
import { ThankYouPage } from './pages/store/ThankYouPage';
import { TrackOrderPage } from './pages/store/TrackOrderPage';
import { AccountPage } from './pages/store/AccountPage';
import { ContentPage } from './pages/store/ContentPage';

import { AdminLayout, type StaffUser } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminOrderEdit } from './pages/admin/AdminOrderEdit';
import { AdminIncompleteOrders } from './pages/admin/AdminIncompleteOrders';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminInventory } from './pages/admin/AdminInventory';
import { AdminCouriers } from './pages/admin/AdminCouriers';
import { AdminMarketing } from './pages/admin/AdminMarketing';
import { AdminContent } from './pages/admin/AdminContent';
import { AdminAppearance } from './pages/admin/AdminAppearance';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminNotifications } from './pages/admin/AdminNotifications';
import { AdminSettings } from './pages/admin/AdminSettings';

const AdminRouter: React.FC = () => {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [section, setSection] = useState<string>('dashboard');
  const [badges, setBadges] = useState<{ pendingOrders?: number; incompleteOrders?: number }>({});

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.staff) {
          setStaff(d.staff);
          if (d.staff.role === 'packer') setSection('orders');
          else if (d.staff.role === 'editor') setSection('products');
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!staff) return;
    fetch('/api/admin/orders?status=all')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setBadges({
            pendingOrders: d.counts?.pending || 0,
            incompleteOrders: d.incompleteCount || 0,
          });
        }
      })
      .catch(() => {});
  }, [staff, section]);

  if (!authChecked) {
    return <div className="min-h-screen bg-[#EEF5F5] flex items-center justify-center text-sm text-[#557077]">Loading Shuddho Admin...</div>;
  }

  const renderSection = () => {
    if (section.startsWith('order:')) {
      const id = section.slice(6);
      return <AdminOrderEdit orderId={id} onBack={() => setSection('orders')} />;
    }
    switch (section) {
      case 'dashboard':
        return <AdminDashboard onNavigate={setSection} />;
      case 'orders':
        return <AdminOrders onEditOrder={(id) => setSection(`order:${id}`)} />;
      case 'orders:new':
        return <AdminOrders onEditOrder={(id) => setSection(`order:${id}`)} initialNewModal />;
      case 'incomplete':
        return <AdminIncompleteOrders onConvertedOrder={(id) => setSection(`order:${id}`)} />;
      case 'customers':
        return <AdminCustomers />;
      case 'products':
        return <AdminProducts />;
      case 'products:new':
        return <AdminProducts initialNewModal />;
      case 'inventory':
        return <AdminInventory />;
      case 'couriers':
        return <AdminCouriers />;
      case 'marketing':
        return <AdminMarketing />;
      case 'content':
        return <AdminContent />;
      case 'appearance':
        return <AdminAppearance />;
      case 'reports':
        return <AdminReports />;
      case 'users':
        return <AdminUsers />;
      case 'notifications':
        return <AdminNotifications />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard onNavigate={setSection} />;
    }
  };

  return (
    <AdminLayout
      activeSection={section}
      onSelectSection={setSection}
      staff={staff}
      onAuthChange={setStaff}
      badges={badges}
    >
      {renderSection()}
    </AdminLayout>
  );
};

const MainRouter: React.FC = () => {
  const { currentPath } = useStore();
  const pathname = currentPath.split('?')[0];

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <AdminRouter />;
  }

  const renderStorePage = () => {
    if (pathname === '/' || pathname === '') return <HomePage />;
    if (pathname === '/shop' || pathname === '/search') return <ShopPage />;
    if (pathname.startsWith('/category/')) {
      return <ShopPage categorySlug={decodeURIComponent(pathname.replace('/category/', ''))} />;
    }
    if (pathname.startsWith('/products/')) {
      return <ProductPage slug={decodeURIComponent(pathname.replace('/products/', ''))} />;
    }
    if (pathname === '/cart') return <CartPage />;
    if (pathname === '/checkout') return <CheckoutPage />;
    if (pathname.startsWith('/thank-you/')) {
      return <ThankYouPage orderNumber={decodeURIComponent(pathname.replace('/thank-you/', ''))} />;
    }
    if (pathname === '/track') return <TrackOrderPage />;
    if (pathname === '/account') return <AccountPage />;
    if (pathname.startsWith('/pages/')) {
      return <ContentPage slug={decodeURIComponent(pathname.replace('/pages/', ''))} />;
    }
    if (pathname === '/blog') return <ContentPage slug="" isBlog />;
    if (pathname.startsWith('/blog/')) {
      return <ContentPage slug={decodeURIComponent(pathname.replace('/blog/', ''))} isBlog />;
    }
    return <HomePage />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StoreHeader />
      <CartDrawer />
      <div className="flex-1">{renderStorePage()}</div>
      <StoreFooter />
      <StoreOverlays />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainRouter />
    </StoreProvider>
  );
}
