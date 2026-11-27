import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  requestAdminLoginCode,
  verifyAdminLoginCode,
  beginPasskeySignIn,
  ApiError,
} from "../lib/api";
import { PersonMark } from "../components/PersonMark";
import { useAdminSession } from "../lib/useAdminSession";
import { CODE_LENGTH } from "../lib/adminLogin";

// Admin sign-in, in two steps: a username gets a 6-digit code pushed to
// the phone registered to it, then that code gets typed back here. A
// verified code sets the session cookie and drops you into the panel.
//
// This page never shows a "you are signed in" screen of its own. Being
// signed in has somewhere to be now, so landing there is the confirmation;
// a card saying it instead would be a dead end you'd have to click out of.
// That applies on arrival too: reaching /login with a live session sends
// you straight through rather than offering to burn a fresh code.
//
// Every error message shown here comes from the server's own `detail`, so
// the wording lives in backend/app/main.py. Nothing on this page decides
// what a failure says.
export function AdminLoginPage() {
  const { user, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const location = useLocation();

  // AdminLayout sends the page you were heading for when it bounces you
  // here, so signing in resumes that rather than always dumping you on the
  // panel's first tab. Only in-app paths are honoured — a `from` is state
  // off a navigation and shouldn't be able to become an off-site redirect.
  const requested = (location.state as { from?: string } | null)?.from;
  const target = requested?.startsWith("/admin") ? requested : "/admin";

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"username" | "code">("username");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await requestAdminLoginCode(username.trim());
      setStep("code");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await verifyAdminLoginCode(username.trim(), code);
      // The cookie is set by now; re-asking is what lights up the header's
      // greeting without a reload.
      await refresh();
      navigate(target, { replace: true });
    } catch (err) {
      // The code stays in the box on purpose. A wrong digit is the usual
      // cause, and clearing it would make the user retype all eight to fix
      // one — while spending another of the five attempts to find out.
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await beginPasskeySignIn(username.trim());
      // Not reachable yet: nothing can enrol a passkey, so the server
      // always refuses above. When enrolment lands, the WebAuthn ceremony
      // goes here — navigator.credentials.get() with the challenge the
      // route returns — and then the same landing as the code path.
      await refresh();
      navigate(target, { replace: true });
    } catch (err) {
      // "Not enrolled." is the server's own wording, same as every other
      // message on this page.
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStep("username");
    setUsername("");
    setCode("");
    setError(null);
  }

  // Already signed in: straight through. `replace` so the back button
  // doesn't bounce between here and the panel.
  if (!loading && user) {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="flex items-center justify-center gap-2.5 text-center text-2xl font-semibold text-ink">
        <PersonMark className="h-6 w-6" />
        Admin Sign-In
      </h1>

      {step === "username" && (
        <>
          <p className="mt-3 text-center text-muted">
            Enter your admin username and we&apos;ll push a confirmation code to your phone.
          </p>

          <form onSubmit={sendCode} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-username" className="text-sm text-muted">
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={64}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username"
                className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>

            <ErrorNote error={error} />

            {/* Side by side, and both grow: the labels are different
                lengths, so letting one size to its text would leave the row
                visibly lopsided. Wraps to stacked on a narrow phone rather
                than squeezing two buttons into 343px. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || !username.trim()}
                className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-medium whitespace-nowrap text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send confirmation code"}
              </button>
              {/* type=button, not submit — inside a <form> an unqualified
                  button submits it, which would fire the code request too. */}
              <button
                type="button"
                onClick={signInWithPasskey}
                disabled={busy || !username.trim()}
                className="flex-1 rounded-full bg-ink px-5 py-3 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign in with Passkey
              </button>
            </div>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <p className="mt-3 text-center text-muted">
            {/* Worded so the length never needs an article: "an 8-digit" but
                "a 6-digit" — hardcoding either reads wrong the day it changes,
                which is exactly what happened going from 8 to 6. */}
            We pushed a code to the phone registered to{" "}
            <span className="font-medium break-words text-ink">{username.trim()}</span> —{" "}
            {CODE_LENGTH} digits, and it expires in 10 minutes.
          </p>

          <form onSubmit={submitCode} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-code" className="text-sm text-muted">
                Confirmation code
              </label>
              <input
                id="admin-code"
                // inputMode numeric, not type="number": a number input brings
                // spinners, accepts "1e5", and silently drops leading zeros —
                // and a code can start with one.
                type="text"
                inputMode="numeric"
                pattern="\d*"
                required
                autoFocus
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={"0".repeat(CODE_LENGTH)}
                className="mt-1 w-full rounded border border-hairline px-3 py-2 text-center font-mono text-lg tracking-[0.35em] outline-none focus:border-brand"
              />
            </div>

            <ErrorNote error={error} />

            <button
              type="submit"
              disabled={busy || code.length !== CODE_LENGTH}
              className="w-full rounded-full bg-brand px-7 py-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
          </form>

          <p className="mt-5 text-center">
            <button type="button" onClick={startOver} className="text-sm text-brand hover:underline">
              Start over
            </button>
          </p>
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

function messageFor(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Something went wrong — try again in a moment.";
}

// role=alert so a rejection is announced rather than silently appearing;
// on this page the error is the entire feedback channel.
function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {error}
    </p>
  );
}
