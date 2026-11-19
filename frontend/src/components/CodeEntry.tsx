import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

const CODE_LENGTH = 4;

// Codes are matched case-insensitively on the server (backend/app/codes.py),
// so normalize as the buyer types: uppercase, letters and digits only.
function normalize(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

/** "Have a code?" box: a buyer types the 4-character code we sent them and
 *  lands on /code/<CODE>. Shown on the Shop page and on CodePage itself
 *  (to retry after a wrong code). */
export function CodeEntry({ error }: { error?: string | null }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length === CODE_LENGTH) navigate(`/code/${code}`);
  }

  return (
    <div>
      <section className="rounded-xl border border-hairline bg-surface p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div>
          <h2 className="font-semibold text-ink">Have a code?</h2>
          <p className="mt-0.5 text-sm text-muted">Enter the code we sent you to see your item.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0">
          <input
            value={code}
            onChange={(e) => setCode(normalize(e.target.value))}
            aria-label="Item code"
            placeholder="ABCD"
            maxLength={CODE_LENGTH}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            // text-base (16px) on purpose: anything smaller makes iOS Safari
            // zoom the page in when the field is focused.
            className="w-full min-w-0 flex-1 rounded-full border border-hairline bg-white px-4 py-2.5 text-center font-mono text-base tracking-[0.35em] text-ink uppercase placeholder:tracking-[0.35em] placeholder:text-muted/60 focus:border-ink focus:outline-none sm:w-36 sm:flex-none"
          />
          <button
            type="submit"
            disabled={code.length !== CODE_LENGTH}
            className="shrink-0 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Go
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
