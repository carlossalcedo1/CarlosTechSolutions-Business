import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { LabeledTextarea } from "../components/DevicePicker";
import { SendRequestDialog } from "../components/SendRequestDialog";

// Contact: one button, one window. The message goes to the admin's phone
// through the same Send Request step as the Services flows, so every way of
// getting in touch ends the same way — a phone number, and a reply by text.
//
// Product pages still link here with ?item= (and &intent=pickup). Those
// open the window straight away with the message written, since the reason
// for coming is already known.

const MESSAGE_LIMIT = 480;

function prefill(item: string | null, intent: string | null) {
  if (!item) return "";
  return intent === "pickup"
    ? `${item} — I would like to arrange local pickup.`
    : `Hi, I'm interested in the ${item}. Is it still available?`;
}

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const item = searchParams.get("item");
  const intent = searchParams.get("intent");

  const [open, setOpen] = useState(!!item);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState(() => prefill(item, intent));

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Contact Us</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink sm:text-xl">
          Questions about a listing, an order or anything else? Send us a message and we&apos;ll
          text you back.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-10 rounded-full bg-brand px-8 py-3 text-lg font-medium text-white hover:bg-brand-dark"
        >
          Contact Us
        </button>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} label="Contact us">
        <div className="px-6 pt-12 pb-8 sm:px-10">
          <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
            Send us a message
          </h2>
          <div className="mt-8">
            <LabeledTextarea
              label="Message"
              value={message}
              onChange={setMessage}
              placeholder="How can we help?"
              maxLength={MESSAGE_LIMIT}
            />
          </div>
          <button
            type="button"
            disabled={!message.trim()}
            onClick={() => setRequesting(true)}
            className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send Request
          </button>
          {!message.trim() && (
            <p className="mt-3 text-center text-sm text-muted">
              Write a message to send a request.
            </p>
          )}
        </div>
      </Modal>

      <SendRequestDialog
        open={requesting}
        draft={{ service: "contact", device: "", details: [`Message: ${message.trim()}`] }}
        onClose={() => setRequesting(false)}
        onSent={() => {
          setRequesting(false);
          setOpen(false);
          // Sent — a second message starts blank.
          setMessage("");
        }}
      />
    </div>
  );
}
