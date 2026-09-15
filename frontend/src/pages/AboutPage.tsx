import { Link } from "react-router-dom";
import { CleanWayMark } from "../components/CleanWayMark";
import { LockScreenMockups } from "../components/LockScreenMockups";
import { ProjectsSection } from "../components/ProjectsSection";

const linkClass = "text-sm font-medium text-brand hover:underline";

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
              Hey, I&apos;m Carlos - the one behind CarlosTechSolutions. I&apos;m a Computer
              Science student at the University of Florida with a genuine passion for technology
              and looking out for others. From full housing swaps to simple repairs, I match every
              job to your budget - backed by full transparency.
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

          {/* Same "twin divide" as ProjectsSplit: the two lock screens on the
              left, what they mean on the right, stacking on narrow screens. */}
          <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-0 md:divide-x md:divide-hairline">
            <div className="md:pr-10">
              <LockScreenMockups />
            </div>

            <div className="flex flex-col justify-center md:pl-10">
              <p className="text-ink">
                Most locked devices aren&apos;t stolen - they&apos;re forgotten. In our experience,
                about 95% of the time the original user simply forgot to sign out before the device
                changed hands, and by the time it reaches us the original owner can no longer be
                reached. Without that sign-out,{" "}
                <a
                  href="https://support.apple.com/en-us/108794"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  Apple&apos;s Activation Lock
                </a>{" "}
                leaves a perfectly good device bricked. Unlocking it puts that hardware back into
                use instead of the landfill, and it&apos;s how we can offer it at a lower price point.
              </p>

              <p className="mt-5 text-sm leading-relaxed text-muted">
                How unlocking, trade-ins, and returns work is covered in our terms, and what we do
                with your information is in our privacy policy.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <Link to="/terms" className={linkClass}>
                  Terms of service &rarr;
                </Link>
                <Link to="/privacy" className={linkClass}>
                  Privacy policy &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Same section as the homepage and Services page. It sits outside the
          narrow content column above so it renders full-bleed, exactly as it
          does on the other two pages. */}
      <ProjectsSection id="projects" />
    </div>
  );
}
