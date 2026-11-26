import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestAdminLoginCode, ApiError } from "../lib/api";
import { PersonMark } from "../components/PersonMark";

// Step one of admin sign-in: hand over an email, get a code posted to it.
//
// Only step one. Entering the code and actually becoming signed in needs
// somewhere to store issued codes, which is coming over from PromptWorks —
// so the "check your inbox" state below is currently the end of the road,
// and says so rather than pointing at a code box that isn't there.
//
// The backend route doesn't exist yet either; see requestAdminLoginCode in
// lib/api.ts for the contract it has to meet. Until it does, submitting
// gets "Couldn't reach the server" from the api client, which is the honest
// answer and not something worth faking a success for.
export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      await requestAdminLoginCode(email);
      setSentTo(email);
    } catch (err) {
      // The not-on-the-allowlist case ("Email has not been registered.")
      // arrives as the server's own detail string, so it needs no handling
      // of its own here — it just gets shown.
      setError(
        err instanceof ApiError ? err.message : "Something went wrong — try again in a moment.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="flex items-center justify-center gap-2.5 text-center text-2xl font-semibold text-ink">
        <PersonMark className="h-6 w-6" />
        Admin Sign-In
      </h1>

      {sentTo ? (
        <div className="mt-8 rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
          <p className="text-ink">
            A confirmation code is on its way to{" "}
            {/* break-words, not break-all: a long address still has to wrap
                rather than overflow the card, but break-all splits a normal
                one mid-domain even when it would have fitted. */}
            <span className="font-medium break-words">{sentTo}</span>.
          </p>
          <p className="mt-3 text-sm text-muted">
            Entering the code isn&apos;t wired up yet — that part lands with the admin panel
            itself.
          </p>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setEmail("");
            }}
            className="mt-5 text-sm text-brand hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-center text-muted">
            Enter your admin email and we&apos;ll send you a confirmation code.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-email" className="text-sm text-muted">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>

            {/* aria-live so the rejection is announced rather than silently
                appearing — this is the one piece of feedback the whole page
                exists to deliver. */}
            {error && (
              <p
                role="alert"
                className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-full bg-brand px-7 py-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send confirmation code"}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center">
        <Link to="/" className="text-sm text-brand hover:underline">
          Back to homepage
        </Link>
      </p>
    </div>
  );
}
