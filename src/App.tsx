import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Toaster } from 'react-hot-toast';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home'));
const ProductFeature = lazy(() => import('./pages/ProductFeature'));
const PublicStore = lazy(() => import('./pages/PublicStore'));
const TrackingPage = lazy(() => import('./pages/TrackingPage').then(m => ({ default: m.TrackingPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout').then(m => ({ default: m.DashboardLayout })));
const Overview = lazy(() => import('./pages/dashboard/Overview').then(m => ({ default: m.Overview })));
const Menu = lazy(() => import('./pages/dashboard/Menu').then(m => ({ default: m.Menu })));
const StoreSettings = lazy(() => import('./pages/dashboard/StoreSettings').then(m => ({ default: m.StoreSettings })));
const Settings = lazy(() => import('./pages/dashboard/Settings').then(m => ({ default: m.Settings })));
const Support = lazy(() => import('./pages/dashboard/Support').then(m => ({ default: m.Support })));
const Inventory = lazy(() => import('./pages/dashboard/Inventory').then(m => ({ default: m.Inventory })));
const Upgrade = lazy(() => import('./pages/dashboard/Upgrade').then(m => ({ default: m.Upgrade })));
const WhatsAppSettings = lazy(() => import('./pages/dashboard/WhatsAppSettings').then(m => ({ default: m.WhatsAppSettings })));
const PaymentSettings = lazy(() => import('./pages/dashboard/PaymentSettings').then(m => ({ default: m.PaymentSettings })));
const Invoices = lazy(() => import('./pages/dashboard/Invoices').then(m => ({ default: m.Invoices })));
const Customers = lazy(() => import('./pages/dashboard/Customers').then(m => ({ default: m.Customers })));
const Orders = lazy(() => import('./pages/dashboard/Orders').then(m => ({ default: m.Orders })));
const Subscription = lazy(() => import('./pages/dashboard/Subscription').then(m => ({ default: m.Subscription })));
const Reports = lazy(() => import('./pages/dashboard/Reports').then(m => ({ default: m.Reports })));
const DeliveryZones = lazy(() => import('./pages/dashboard/DeliveryZones').then(m => ({ default: m.DeliveryZones })));
const PrinterSettings = lazy(() => import('./pages/dashboard/PrinterSettings').then(m => ({ default: m.PrinterSettings })));
const Discounts = lazy(() => import('./pages/dashboard/Discounts').then(m => ({ default: m.Discounts })));
const Team = lazy(() => import('./pages/dashboard/Team').then(m => ({ default: m.Team })));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" />;
  if (user?.role === 'admin') return <Navigate to="/admin" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
          <Toaster position="top-right" />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/cardapio-digital" element={<ProductFeature type="cardapio" />} />
              <Route path="/pedidos-whatsapp" element={<ProductFeature type="whatsapp" />} />
              <Route path="/painel-gestao" element={<ProductFeature type="painel" />} />
              <Route path="/app-whitelabel" element={<ProductFeature type="whitelabel" />} />
              
              {/* Public Store Route */}
              <Route path="/loja/:storeName" element={<PublicStore />} />

              {/* Order Tracking */}
              <Route path="/rastrear/:storeSlug" element={<TrackingPage />} />
              
              {/* Admin Dashboard */}
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
              
              {/* Dashboard Routes */}
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }>
                <Route index element={<Overview />} />
                <Route path="menu" element={<Menu />} />
                <Route path="store" element={<StoreSettings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="support" element={<Support />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="payments" element={<PaymentSettings />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="whatsapp" element={<WhatsAppSettings />} />
                <Route path="customers" element={<Customers />} />
                <Route path="orders" element={<Orders />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="reports" element={<Reports />} />
                <Route path="printer" element={<PrinterSettings />} />
                <Route path="discounts" element={<Discounts />} />
                <Route path="team" element={<Team />} />
                <Route path="delivery-zones" element={<DeliveryZones />} />
              </Route>
              <Route path="/dashboard/upgrade" element={
                <PrivateRoute>
                  <Upgrade />
                </PrivateRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
