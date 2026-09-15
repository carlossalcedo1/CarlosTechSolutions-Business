import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
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
import { NotFoundPage } from "./pages/NotFoundPage";
import { ScrollToTop } from "./components/ScrollToTop";

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
