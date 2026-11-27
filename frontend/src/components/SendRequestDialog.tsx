import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { LabeledInput } from "./DevicePicker";
import { ApiError, submitServiceRequest, type ServiceRequestPayload } from "../lib/api";

// The last window of each Services flow: a phone number, and the request
// goes to us. It opens over the window it came from rather than replacing
// it, so closing it puts you back on your answers, not at the start.

export type RequestDraft = Omit<ServiceRequestPayload, "phone" | "website">;

function phoneDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

// The same (305) 763-2541 shape the server sends to Pushover.
function formatPhone(raw: string) {
  const d = phoneDigits(raw);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

export function SendRequestDialog({
  open,
  draft,
  onClose,
  onSent,
}: {
  open: boolean;
  draft: RequestDraft;
  // Back to the window underneath.
  onClose: () => void;
  // Sent and acknowledged: close everything.
  onSent: () => void;
}) {
  const [phone, setPhone] = useState("");
  // Hidden from people; bots that fill every field fill this one.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"form" | "sending" | "sent">("form");
  const [error, setError] = useState<string | null>(null);

  // A fresh request each time the window opens; the number is kept, since
  // it's the same person.
  useEffect(() => {
    if (open) {
      setState("form");
      setError(null);
    }
  }, [open]);

  const valid = phoneDigits(phone).length === 10;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      await submitServiceRequest({ ...draft, phone, website });
      setState("sent");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't send your request right now. Please text us at (305) 763-2541.",
      );
      setState("form");
    }
  }

  return (
    <Modal open={open} onClose={state === "sent" ? onSent : onClose} label="Send request">
      {state === "sent" ? (
        <div className="px-6 pt-12 pb-8 text-center sm:px-10">
          <h2 className="text-2xl font-semibold text-ink sm:text-3xl">Request sent!</h2>
          <p className="mt-3 text-lg text-ink">
            We&apos;ll reach out to you at {formatPhone(phone)} with next steps.
          </p>
          <button
            type="button"
            onClick={onSent}
            className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="px-6 pt-12 pb-8 sm:px-10">
          <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
            Where can we reach you?
          </h2>
          {draft.device && <p className="mt-2 text-center text-muted">{draft.device}</p>}

          <div className="mt-8">
            <LabeledInput
              label="Phone number"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={setPhone}
              placeholder="(305) 555-0123"
            />
          </div>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
          />

          {error && (
            <p
              role="alert"
              className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-6 rounded-2xl bg-black/[0.04] px-5 py-4 text-sm leading-relaxed text-ink">
            We will reach out to you at the phone number provided with next steps! Your phone number
            will not be used for any form of tracking or data collection.
          </div>

          <button
            type="submit"
            disabled={!valid || state === "sending"}
            className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === "sending" ? "Sending…" : "Done"}
          </button>
        </form>
      )}
    </Modal>
  );
}
