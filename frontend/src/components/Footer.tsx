import { Link } from "react-router-dom";
import { CONTACT_EMAIL, CONTACT_PHONE } from "../lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm sm:grid-cols-4">
        <div>
          <p className="font-semibold text-ink">Carlos Tech Solutions</p>
          <p className="mt-2 text-muted">New, used, and recycled tech for an affordable audience.</p>
        </div>

        <div>
          <p className="font-semibold text-ink">Shop</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              <Link to="/shop?category=Phones" className="hover:text-brand">
                Phones
              </Link>
            </li>
            <li>
              <Link to="/shop?category=Laptops" className="hover:text-brand">
                Laptops
              </Link>
            </li>
            <li>
              <Link to="/shop?category=Desktops" className="hover:text-brand">
                Desktops
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-ink">Support</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              <Link to="/help" className="hover:text-brand">
                Help center
              </Link>
            </li>
            <li>
              <Link to="/about#warranty" className="hover:text-brand">
                Warranty
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-brand">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-ink">Reach us</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>Gainesville and Miami, FL</li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={`tel:${CONTACT_PHONE}`} className="hover:text-brand">
                {CONTACT_PHONE}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
