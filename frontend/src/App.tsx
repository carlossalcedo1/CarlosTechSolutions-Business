import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CodePage } from "./pages/CodePage";
import { SellDevicePage } from "./pages/SellDevicePage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { CheckoutSuccessPage } from "./pages/CheckoutSuccessPage";
import { CheckoutCancelledPage } from "./pages/CheckoutCancelledPage";
import { ServicesPage } from "./pages/ServicesPage";
import { ReturnPolicyPage } from "./pages/ReturnPolicyPage";
import { ConditionsPage } from "./pages/ConditionsPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { HelpCenterPage } from "./pages/HelpCenterPage";
import { PromptworksPage } from "./pages/PromptworksPage";
import { RhinoTradePage } from "./pages/RhinoTradePage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ScrollToTop } from "./components/ScrollToTop";
import { AdminSessionProvider } from "./lib/useAdminSession";
import { AdminLayout } from "./components/AdminLayout";
import { AdminListPage } from "./pages/admin/AdminListPage";
import { AdminCodesPage } from "./pages/admin/AdminCodesPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { CreateListingPage } from "./pages/admin/list/CreateListingPage";
import { PickListingPage } from "./pages/admin/list/PickListingPage";
import { EditListingPage } from "./pages/admin/list/EditListingPage";
import { DeleteListingPage } from "./pages/admin/list/DeleteListingPage";

export function App() {
  return (
    <BrowserRouter>
      {/* Inside the router so the provider can live above every page
          and still be one fetch for the whole app. */}
      <AdminSessionProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="code" element={<CodePage />} />
          <Route path="code/:code" element={<CodePage />} />
          <Route path="sell" element={<SellDevicePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/cancelled" element={<CheckoutCancelledPage />} />
          <Route path="help" element={<HelpCenterPage />} />
          <Route path="returns" element={<ReturnPolicyPage />} />
          <Route path="conditions" element={<ConditionsPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
          <Route path="promptworks" element={<PromptworksPage />} />
          <Route path="rhinotrade" element={<RhinoTradePage />} />
          <Route path="login" element={<AdminLoginPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* The panel sits outside the shop's Layout on purpose: its own
            frame, no shop header or footer, and AdminLayout turns anyone
            without a session away before any of it renders. That guard is
            for the look of the thing, not the security of it — what
            actually protects admin data is require_admin on the API
            routes, since a client-side check is only ever a suggestion. */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/list" replace />} />
          <Route path="list" element={<AdminListPage />} />
          {/* Each step is a route, so a phone's back button walks back
              through a flow instead of leaving the panel. The pickers are
              keyed by mode: they're the same component at the same spot in
              the tree, and React would otherwise carry the search text from
              Edit's picker into Delete's. */}
          <Route path="list/create" element={<CreateListingPage />} />
          <Route path="list/edit" element={<PickListingPage key="edit" mode="edit" />} />
          <Route path="list/edit/:id" element={<EditListingPage />} />
          <Route path="list/delete" element={<PickListingPage key="delete" mode="delete" />} />
          <Route path="list/delete/:id" element={<DeleteListingPage />} />
          <Route path="codes" element={<AdminCodesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/admin/list" replace />} />
        </Route>
      </Routes>
      </AdminSessionProvider>
    </BrowserRouter>
  );
}
