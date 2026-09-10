import { Link } from "react-router-dom";
import { projects } from "../data/projects";

// The "twin divide": two projects side by side with a vertical rule between
// them, stacking on narrow screens. Used by both the homepage and the About
// page so the two never disagree.
const linkClass = "mt-5 inline-block text-sm font-medium text-brand hover:underline";

const badgeTone = {
  neutral: "border-hairline text-muted",
  green: "border-green-300 bg-green-50 text-green-700",
};

export function ProjectsSplit() {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-hairline">
      {projects.map((project, i) => (
        <div key={project.name} className={i === 0 ? "md:pr-10" : "md:pl-10"}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink">{project.name}</h3>
            {project.status && (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  badgeTone[project.statusTone ?? "neutral"]
                }`}
              >
                {project.status}
              </span>
            )}
          </div>

          <p className="mt-3 text-lg leading-snug font-medium text-ink">{project.headline}</p>
          <p className="mt-3 leading-relaxed text-muted">{project.body}</p>

          {project.url ? (
            <a href={project.url} target="_blank" rel="noreferrer" className={linkClass}>
              {project.linkLabel} &rarr;
            </a>
          ) : (
            <Link to="/about" className={linkClass}>
              {project.linkLabel} &rarr;
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
