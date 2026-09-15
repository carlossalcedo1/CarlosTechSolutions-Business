import { PROMPTWORKS_URL } from "../lib/constants";

// Carlos's other projects, shown on both the homepage and the About page.
// Single source of truth so the copy can't drift between the two.
export interface Project {
  name: string;
  headline: string;
  body: string;
  /** Badge text, e.g. "Coming soon". Omit once the project is live. */
  status?: string;
  /** Badge colour. "green" reads as live/active; "neutral" (default) as pending. */
  statusTone?: "neutral" | "green";
  /** Text on the link under the project. */
  linkLabel: string;
  /**
   * External site. When set, the link opens it in a new tab; until then the
   * link falls back to the About page so nothing is a dead end.
   */
  url?: string;
}

export const projects: Project[] = [
  {
    name: "PromptWorks (WebApp)",
    status: "Beta Testing",
    statusTone: "green",
    headline: "You use AI every day. Nobody taught you how to ask.",
    body: "PromptWorks turns prompt engineering into reps — real scenarios, scored feedback, and a number that shows the skill actually moving.",
    linkLabel: "Navigate",
    url: PROMPTWORKS_URL,
  },
  {
    name: "RhinoTrade",
    status: "Coming soon",
    headline: "Automated trading, with the data science behind it.",
    body: "A trading bot backed by a data science layer — research, signals, and testing before anything runs live. In development.",
    linkLabel: "Coming soon",
  },
];
