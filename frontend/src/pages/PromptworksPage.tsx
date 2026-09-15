import { PROMPTWORKS_URL } from "../lib/constants";

// Landing page for a bare /promptworks link — e.g. handed out without the
// subdomain — that sends the visitor on to the actual site.
export function PromptworksPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">PromptWorks</h1>
      <p className="mt-2 text-muted">
        You use AI every day. Nobody taught you how to ask.
      </p>
      <a
        href={PROMPTWORKS_URL}
        className="mt-8 rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
      >
        Go to PromptWorks
      </a>
    </div>
  );
}
