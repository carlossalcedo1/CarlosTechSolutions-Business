import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

// Every page in the site map sits inside this shell so the header and
// footer stay identical everywhere without being repeated per-page.
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
