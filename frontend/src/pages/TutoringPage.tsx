import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../components/Modal";
import { LabeledTextarea } from "../components/DevicePicker";
import { SendRequestDialog } from "../components/SendRequestDialog";

// Tutoring: the printed flyer, as a page. The flyer's QR code points here
// (nexfixtech.com/tutoring), so this is the page a parent lands on with the
// flyer still in their hand — same headline, same offers, same number.
//
// Requesting works exactly like Contact: one message, then the shared Send
// Request step for a phone number. It goes up as service "tutoring", which
// the server titles "Request: Tutoring" so it stands apart on the phone.

const MESSAGE_LIMIT = 480;

const SUBJECTS = ["Algebra 1 & 2", "Geometry", "Precalculus", "Calculus 1 & 2", "K–12 Math"];

const EXPECT = [
  "Homework help",
  "Concept review",
  "Guided test preparation",
  "Study skills & organization",
  "Connecting concepts to real-life examples",
  "Building confidence through repetition and the hardest problems",
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        d="M6 10.5l2.5 2.5L14 7.5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RequestButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-brand px-8 py-3 text-lg font-medium text-white hover:bg-brand-dark"
    >
      Request Tutoring
    </button>
  );
}

export function TutoringPage() {
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="pb-24">
      {/* Hero: who, what and where, with the headshot the About page uses. */}
      <section className="mx-auto max-w-5xl px-4 pt-14">
        <div className="flex flex-col-reverse items-center gap-10 md:flex-row md:items-start md:justify-between">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
              Math tutor · Personalized learning
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Math that finally <span className="text-brand">clicks.</span>
            </h1>
            <p className="mt-5 text-lg text-ink">{SUBJECTS.join(" · ")}</p>
            <p className="mt-2 text-muted">Gainesville &amp; Miami, FL · or on Zoom</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm md:justify-start">
              <span className="rounded-full border border-hairline px-3 py-1 text-ink">
                Middle School, High School &amp; Undergrad
              </span>
              <span className="rounded-full border border-hairline px-3 py-1 text-ink">
                English · Español
              </span>
            </div>
            <div className="mt-8">
              <RequestButton onClick={() => setOpen(true)} />
            </div>
          </div>

          <figure className="shrink-0 text-center">
            <img
              src="/carlos-headshot.jpg"
              alt="Carlos"
              className="mx-auto h-40 w-40 rounded-full object-cover"
            />
            <figcaption className="mt-3">
              <span className="block font-semibold text-ink">University of Florida Student</span>
              <span className="block text-sm text-muted">
                Studying Computer Science &amp;
                <br />
                Business Administration
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4">
        <div className="rounded-2xl border border-hairline bg-surface px-6 py-8 sm:px-10">
          <blockquote className="text-xl leading-relaxed text-ink italic">
            &ldquo;Math has never been about just solving problems and memorization, but instead
            understanding how it all connects and how problems can be solved in multiple different
            ways.&rdquo;
          </blockquote>
          <p className="mt-6 border-t border-hairline pt-6 text-lg leading-relaxed text-ink">
            I&apos;m passionate about helping students learn, because so many of them run into{" "}
            <span className="font-semibold">the same problems I once did</span>. Every lesson is
            personalized, and I connect with each student{" "}
            <span className="font-semibold text-brand">like a friend who&apos;s always there for them.</span>
          </p>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4">
        <h2 className="text-2xl font-semibold text-ink">My experience</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-hairline px-6 py-5">
            <p className="font-semibold text-ink">3 years working with K–12 kids</p>
            <p className="mt-1 text-muted">City of Gainesville &amp; Fit Kids of America (Miami, FL)</p>
          </div>
          <div className="rounded-2xl border border-hairline px-6 py-5">
            <p className="font-semibold text-ink">4 students tutored</p>
            <p className="mt-1 text-muted">Each showed noticeable progress in skills and grades</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4">
        <h2 className="text-2xl font-semibold text-ink">What you can expect</h2>
        <ul className="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-2">
          {EXPECT.map((item) => (
            <li key={item} className="flex gap-3 text-lg text-ink">
              <Check />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* The two offers from the flyer, side by side. */}
      <section className="mx-auto mt-14 grid max-w-5xl gap-4 px-4 md:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl bg-brand px-6 py-6 text-white">
          <p className="text-3xl font-bold">50% off</p>
          <p className="mt-1 text-lg">your first session</p>
        </div>
        <div className="rounded-2xl border border-brand-bright/40 bg-brand-bright/10 px-6 py-6">
          <p className="text-2xl font-semibold text-ink">iPad + Apple Pencil deal</p>
          <p className="mt-1 text-ink">
            With at least 2 sessions, get a discounted iPad + Pencil from the{" "}
            <Link to="/shop" className="font-medium text-brand hover:underline">
              shop
            </Link>{" "}
            to make math homework easier.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-ink">Ready to get started?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink">
          Tell me about the student and what they&apos;re working on, and I&apos;ll text you back
          to set up a first session. Or call or text{" "}
          <a href="tel:+13057632541" className="font-semibold whitespace-nowrap text-brand hover:underline">
            (305) 763-2541
          </a>
          .
        </p>
        <div className="mt-8">
          <RequestButton onClick={() => setOpen(true)} />
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} label="Request tutoring">
        <div className="px-6 pt-12 pb-8 sm:px-10">
          <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
            Request tutoring
          </h2>
          <p className="mt-2 text-center text-muted">
            Include the grade, the class or topic, and when the student is free — in person or on
            Zoom.
          </p>
          <div className="mt-8">
            <LabeledTextarea
              label="Details"
              value={message}
              onChange={setMessage}
              placeholder="e.g. 10th grade, Algebra 2 — test on Friday. Weekday evenings, Zoom works."
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
              Write the details to send a request.
            </p>
          )}
        </div>
      </Modal>

      <SendRequestDialog
        open={requesting}
        draft={{ service: "tutoring", device: "", details: [`Message: ${message.trim()}`] }}
        onClose={() => setRequesting(false)}
        onSent={() => {
          setRequesting(false);
          setOpen(false);
          setMessage("");
        }}
      />
    </div>
  );
}
