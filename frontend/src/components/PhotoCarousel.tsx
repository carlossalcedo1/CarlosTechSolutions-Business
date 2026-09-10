import { useState } from "react";

// Real photos off the actual repair bench (not stock/placeholder) — see
// LAUNCH_CHECKLIST.md Phase 7's "real photos" item, partially crossed off
// here. Captions are a deliberate design choice, not decoration: each one
// names what's happening in that slide so the carousel reads as "here's
// real work" rather than just "here's some photos".
const SLIDES = [
  { src: "/carousel/IMG_5624.jpg", caption: "Every repair starts here" },
  { src: "/carousel/IMG_5627.jpg", caption: "Cracked back glass? We fix that." },
  { src: "/carousel/IMG_5628.jpg", caption: "iPhone 13 mini — full teardown" },
  { src: "/carousel/IMG_5629.jpg", caption: "Battery replacement, done right" },
  { src: "/carousel/IMG_5630.jpg", caption: "Complete destruction? No problem." },
];

// Manual only — no auto-advance. Arrows + dots are the only way through.
export function PhotoCarousel() {
  const [index, setIndex] = useState(0);

  function go(delta: number) {
    setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);
  }

  const slide = SLIDES[index];

  return (
    <div className="mt-16">
      <h2 className="text-center text-lg font-semibold text-ink">Here&apos;s some recent repairs</h2>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-hairline">
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.caption}
          className="h-56 w-full object-cover sm:h-96"
        />

        <button
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow transition hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next photo"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow transition hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* Subheading under the photo, swapping with it as the slide changes.
          text-center explicitly, rather than relying on this component's
          parent happening to set it — this should center regardless of
          where PhotoCarousel is used. */}
      <p className="mt-3 text-center text-sm font-medium text-ink">{slide.caption}</p>

      <div className="mt-2 flex justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setIndex(i)}
            aria-label={`Go to photo ${i + 1}`}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === index ? "bg-ink" : "bg-hairline"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
