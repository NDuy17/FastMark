import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from './components/AdminLayout';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import { ConfirmProvider, ToastProvider } from './components/ui/Feedback';
import { AuthProvider, useAuth } from './context/AuthContext';
import { configError } from './firebase';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import SellerVerificationsPage from './pages/SellerVerificationsPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import ReportManagement from './pages/ReportManagement';
import ReviewManagement from './pages/ReviewManagement';
import SystemNotification from './pages/SystemNotification';
import ShopsPage from './pages/ShopsPage';
import ShopDetailPage from './pages/ShopDetailPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ReservationsPage from './pages/ReservationsPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import SellerPlansPage from './pages/SellerPlansPage';
import SellerSubscriptionsPage from './pages/SellerSubscriptionsPage';
import BannerPurchasesPage from './pages/BannerPurchasesPage';
import BannerPlansPage from './pages/BannerPlansPage';
import SellerBannersPage from './pages/SellerBannersPage';
import BanksPage from './pages/BanksPage';
import WithdrawalsPage from './pages/WithdrawalsPage';
import FinancePage from './pages/FinancePage';
import AuditLogPage from './pages/AuditLogPage';
import ComingSoonPage from './components/admin/ComingSoonPage';

function ProtectedRoutes() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="loading-screen">
        Tài khoản không có quyền admin (Role = 3).
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:accountId" element={<AccountDetailPage />} />
        <Route path="verifications" element={<SellerVerificationsPage />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="shops/:shopId" element={<ShopDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:productId" element={<ProductDetailPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />
        <Route path="reports" element={<ReportManagement />} />
        <Route path="reviews" element={<ReviewManagement />} />
        <Route path="notifications" element={<SystemNotification />} />
        <Route path="seller-plans" element={<SellerPlansPage />} />
        <Route path="seller-subscriptions" element={<SellerSubscriptionsPage />} />
        <Route path="banner-plans" element={<BannerPlansPage />} />
        <Route path="banner-purchases" element={<BannerPurchasesPage />} />
        <Route path="seller-banners" element={<SellerBannersPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
        <Route path="banks" element={<BanksPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="content/terms" element={<ComingSoonPage title="Điều khoản" description="Quản lý nội dung điều khoản sử dụng FastMark." backTo="/" />} />
        <Route path="content/privacy" element={<ComingSoonPage title="Chính sách bảo mật" description="Quản lý chính sách bảo mật và quyền riêng tư." backTo="/" />} />
        <Route path="content/faq" element={<ComingSoonPage title="FAQ" description="Quản lý câu hỏi thường gặp." backTo="/" />} />
        <Route path="content/guide" element={<ComingSoonPage title="Hướng dẫn sử dụng" description="Quản lý hướng dẫn cho người mua và người bán." backTo="/" />} />
        <Route path="settings/fees" element={<ComingSoonPage title="Cấu hình phí" description="Thiết lập phí dịch vụ, hoa hồng và biểu phí hệ thống." backTo="/finance" />} />
        <Route path="settings/deposit" element={<ComingSoonPage title="Cấu hình đặt cọc" description="Thiết lập quy tắc và mức đặt cọc khi giữ hàng." backTo="/" />} />
        <Route path="settings/hold-time" element={<ComingSoonPage title="Thời gian giữ hàng" description="Cấu hình thời gian giữ hàng mặc định và theo danh mục." backTo="/reservations" />} />
        <Route path="subscription-plans" element={<SellerPlansPage />} />
        <Route path="banners" element={<Navigate to="/seller-banners?filter=active" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  if (configError) {
    return <ConfigErrorScreen message={configError} />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default function App() {
  return <AppRoutes />;
}
