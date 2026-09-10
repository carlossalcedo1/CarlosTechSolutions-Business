import { ProjectsSplit } from "./ProjectsSplit";

// The full projects section — eyebrow, heading, and the twin divide — as it
// appears on the homepage. The Services page renders this same component so
// the two can't drift apart in wording or layout; edit it here and both
// pages change together.
export function ProjectsSection({ id }: { id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Services</p>
        <h2 className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight text-ink">
          What else I&apos;m building.
        </h2>

        <div className="mt-10">
          <ProjectsSplit />
        </div>
      </div>
    </section>
  );
}
