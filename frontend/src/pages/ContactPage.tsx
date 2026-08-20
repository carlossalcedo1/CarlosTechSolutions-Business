import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { locations } from "../data/locations";
import { CONTACT_EMAIL, CONTACT_PHONE } from "../lib/constants";
import { PlaceholderImage } from "../components/PlaceholderImage";

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const prefillItem = searchParams.get("item");

  const [form, setForm] = useState({
    name: "",
    email: "",
    message: prefillItem ? `Hi, I'm interested in the ${prefillItem}. Is it still available?` : "",
  });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Stage 2 wires this to `POST /contact` (writes to `contact_messages`).
    // For now this just confirms locally so the flow is demonstrable.
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Send us a message</h1>

          {sent ? (
            <p className="mt-4 rounded border border-hairline bg-surface p-4 text-sm text-ink">
              Thanks, {form.name || "there"} — we&apos;ll get back to you at {form.email} soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-muted">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Send
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink">Direct contact</h2>
          <p className="mt-2 text-sm text-muted">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-sm text-muted">
            <a href={`tel:${CONTACT_PHONE}`} className="hover:text-brand">
              {CONTACT_PHONE}
            </a>
          </p>

          <h2 className="mt-6 text-lg font-semibold text-ink">Locations</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {locations.map((loc) => (
              <div key={loc.city} className="overflow-hidden rounded border border-hairline">
                <PlaceholderImage label={`${loc.city}, ${loc.state}`} className="h-24 w-full" />
                <div className="p-2 text-xs text-muted">
                  <p>{loc.hours}</p>
                  <p>{loc.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
