import { CleanWayMark } from "../components/CleanWayMark";
import { ProjectsSection } from "../components/ProjectsSection";

export function AboutPage() {
  return (
    <div>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <img
            src="/carlos-headshot.jpg"
            alt="Carlos"
            className="h-28 w-28 shrink-0 rounded-full object-cover"
          />
          <div>
            <h1 className="text-2xl font-semibold text-ink">Meet Carlos</h1>
            <p className="mt-1 text-muted">
              Who you are, your background, why buyers can trust you.
            </p>
            <p className="mt-1 text-muted">Based in Gainesville, FL - ships nationwide.</p>
          </div>
        </div>

        <section id="clean-way" className="mt-10 scroll-mt-24 border-t border-hairline pt-8">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-ink">
            <CleanWayMark className="h-5 w-5" />
            The Clean Way
          </h2>
          <p className="mt-3 text-ink">
            Every device has a story before it reaches you. Some come from people who no longer need
            them - instead of sitting in a drawer or ending up in the trash, they get a second life.
            Others are iCloud-locked or MDM-locked devices from businesses and schools upgrading their
            fleets - devices that would otherwise be scrapped as e-waste. We verify, unlock, and test
            each one before it&apos;s listed, so what you&apos;re buying is safe, legal, and fully usable.
          </p>
        </section>
      </div>

      {/* Same section as the homepage and Services page. It sits outside the
          narrow content column above so it renders full-bleed, exactly as it
          does on the other two pages. */}
      <ProjectsSection id="projects" />
    </div>
  );
}
