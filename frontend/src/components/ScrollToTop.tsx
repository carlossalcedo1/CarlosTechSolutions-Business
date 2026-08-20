import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router (unlike a full page load) doesn't reset scroll position
// between route changes on its own. This restores that default: top of
// the page on a normal navigation, or scroll-to-element when a link
// carries a hash (e.g. /about#clean-way from the header/footer).
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
