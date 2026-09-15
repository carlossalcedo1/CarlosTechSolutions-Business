import { useRef, useState } from "react";

// Real photos off the actual repair bench (not stock/placeholder) — see
// LAUNCH_CHECKLIST.md Phase 7's "real photos" item, partially crossed off
// here. Captions are a deliberate design choice, not decoration: each one
// names what's happening in that slide so the carousel reads as "here's
// real work" rather than just "here's some photos".
const SLIDES = [
  { src: "/carousel/IMG_5624.jpg", caption: "Every repair starts here" },
  { src: "/carousel/IMG_5627.jpg", caption: "Cracked back glass? We fix that." },
  { src: "/carousel/IMG_5628.jpg", caption: "iPhone 13 mini — full teardown" },
  { src: "/carousel/IMG_5629.jpg", caption: "Complete destruction? No problem." },
  { src: "/carousel/IMG_5630.jpg", caption: "Looking good again." },
];

// Manual only — no auto-advance. The slides sit in a native scroll-snap
// track, so swiping (touch or trackpad) just works with real momentum and no
// gesture code. Arrows and dots scroll that same track, and the current
// index is read back from the scroll position, so all three stay in sync.
export function PhotoCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function scrollToSlide(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  function go(delta: number) {
    scrollToSlide((index + delta + SLIDES.length) % SLIDES.length);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  return (
    <div className="mt-16">
      <h2 className="text-center text-lg font-semibold text-ink">Here&apos;s some recent repairs</h2>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-hairline">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((s, i) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.caption}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
              // A fixed desktop height paired with the hero's fluid
              // max-w-4xl width meant the crop ratio changed with viewport
              // width — a tablet in landscape and a wide monitor showed a
              // different amount of each photo. aspect-ratio + h-auto keeps
              // the crop identical at every desktop width; the fixed mobile
              // height below the sm breakpoint is untouched.
              className="h-56 w-full shrink-0 snap-center object-cover sm:h-auto sm:aspect-[9/4]"
            />
          ))}
        </div>

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
      <p className="mt-3 text-center text-sm font-medium text-ink">{SLIDES[index].caption}</p>

      <div className="mt-2 flex justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            onClick={() => scrollToSlide(i)}
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
