import { Link } from "react-router-dom";
import { ProjectsSection } from "../components/ProjectsSection";

// Copy here is drawn from the brief's "Business" section (unlocking
// iCloud/MDM-locked devices, device sales, trade-ins). Treat it as a
// first draft — it's the page most worth rewriting in your own voice.
const SERVICES = [
  {
    title: "Device unlocking",
    body: "iCloud- and MDM-locked iPhones, iPads, and laptops. We verify ownership first, then unlock, test, and hand back a device that's fully usable again.",
    notice: "We only unlock Apple devices.",
    cta: { label: "Ask about an unlock", to: "/contact?intent=unlock" },
  },
  {
    title: "Buy refurbished tech",
    body: "New, used, and refurbished Apple, Dell, and other brands — every device factory unlocked unless specified, and backed by 7-day returns.",
    cta: { label: "Shop inventory", to: "/shop" },
  },
  {
    title: "Sell or trade in",
    body: "Tell us what you have, get an estimate in minutes, then ship it in or drop it off. Payment goes out once we've verified the device.",
    cta: { label: "Get a quote", to: "/sell" },
  },
  {
    title: "Fix your device",
    body: "Cracked screens, dead batteries, charging ports, and machines that won't boot. Send us the details or bring it in — you get a diagnosis and a price before any work starts.",
    cta: { label: "Get a repair quote", to: "/contact?intent=repair" },
  },
];

export function ServicesPage() {
  return (
    <div>
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Services</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Buying, selling, unlocking, repairing, you name it we do it!
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <div key={service.title} className="flex flex-col rounded-lg border border-hairline p-6">
              <h2 className="text-lg font-semibold text-ink">{service.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{service.body}</p>
              {"notice" in service && service.notice && (
                <p className="mt-3 text-sm font-medium text-red-700">{service.notice}</p>
              )}
              <div className="flex-1" />
              <Link
                to={service.cta.to}
                className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
              >
                {service.cta.label} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Same section as the homepage, rendered from one shared component */}
      <ProjectsSection />

      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-lg font-semibold text-ink">Not sure which one you need?</p>
          <p className="mt-2 text-muted">
            Send us the details and we&apos;ll point you in the right direction.
          </p>
          <Link
            to="/contact"
            className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
