import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestAdminLoginCode, verifyAdminLoginCode, ApiError } from "../lib/api";
import { PersonMark } from "../components/PersonMark";
import { CODE_LENGTH } from "../lib/adminLogin";

// Admin sign-in, in two steps: a username gets an 8-digit code pushed to
// the phone registered to it, then that code gets typed back here.
//
// A verified code doesn't sign anyone in yet. The backend burns it and
// returns a bare ok — there's no admin panel to hold a session open, so
// issuing a token now would mean designing its lifetime and revocation
// against nothing. The confirmed state below says so rather than dropping
// the user somewhere that looks signed in and isn't.
//
// Every error message shown here comes from the server's own `detail`, so
// the wording lives in backend/app/main.py. Nothing on this page decides
// what a failure says.
export function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"username" | "code" | "done">("username");
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
      setStep("done");
    } catch (err) {
      // The code stays in the box on purpose. A wrong digit is the usual
      // cause, and clearing it would make the user retype all eight to fix
      // one — while spending another of the five attempts to find out.
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

            <button
              type="submit"
              disabled={busy || !username.trim()}
              className="w-full rounded-full bg-brand px-7 py-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send confirmation code"}
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <p className="mt-3 text-center text-muted">
            We pushed an {CODE_LENGTH}-digit code to the phone registered to{" "}
            <span className="font-medium break-words text-ink">{username.trim()}</span>. It
            expires in 10 minutes.
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

      {step === "done" && (
        <div className="mt-8 rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
          <p className="font-medium text-ink">Code confirmed.</p>
          <p className="mt-3 text-sm text-muted">
            You&apos;re not signed in yet — there&apos;s no admin panel to sign in to. That
            lands with the panel itself, and this page will carry you into it when it does.
          </p>
          <button
            type="button"
            onClick={startOver}
            className="mt-5 text-sm text-brand hover:underline"
          >
            Start over
          </button>
        </div>
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
