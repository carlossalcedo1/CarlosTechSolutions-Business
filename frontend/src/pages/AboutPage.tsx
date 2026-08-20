import { PlaceholderImage } from "../components/PlaceholderImage";

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <PlaceholderImage label="Carlos" className="h-28 w-28 shrink-0 rounded-full" />
        <div>
          <h1 className="text-2xl font-semibold text-ink">Meet Carlos</h1>
          <p className="mt-1 text-muted">Who you are, your background, why buyers can trust you.</p>
          <p className="mt-1 text-muted">Based in Gainesville and Miami, FL - ships nationwide.</p>
        </div>
      </div>

      <section id="clean-way" className="mt-10 scroll-mt-24 border-t border-hairline pt-8">
        <h2 className="text-xl font-semibold text-ink">The Clean Way</h2>
        <p className="mt-3 text-ink">
          Every device has a story before it reaches you. Some come from people who no longer need
          them - instead of sitting in a drawer or ending up in the trash, they get a second life.
          Others are iCloud-locked or MDM-locked devices from businesses and schools upgrading their
          fleets - devices that would otherwise be scrapped as e-waste. We verify, unlock, and test
          each one before it&apos;s listed, so what you&apos;re buying is safe, legal, and fully usable.
        </p>
      </section>

      <section id="warranty" className="mt-10 scroll-mt-24 rounded border border-hairline bg-surface px-6 py-4 text-center text-sm font-medium text-ink">
        90-day warranty on all devices · 30-day returns · Verified ownership on every unlock
      </section>
    </div>
  );
}
