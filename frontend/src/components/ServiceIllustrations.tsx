// Illustrations for "Where can I get service?" on the Services page. Drawn
// for this site in the flat style of Apple's repair page rather than taken
// from it — that artwork is Apple's, and a repair shop showing it would read
// as claiming to be an Apple service provider.
//
// Decorative only (aria-hidden); the heading and text under each carry it.

const INK = "#1f2328";
const ORANGE = "#f26b0f";
const ORANGE_SOFT = "#fbc9a3";
const SKIN = "#c68a64";
const SKIN_DARK = "#a86d4b";

export function InPersonIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 300" aria-hidden="true" className={className}>
      {/* A street map */}
      <g transform="rotate(-4 200 150)">
        <rect x="95" y="60" width="210" height="170" rx="14" fill="#fff" />
        <g stroke="#fde3cf" strokeWidth="9" fill="none" strokeLinecap="round">
          <path d="M95 120 H305" />
          <path d="M95 185 H240 Q260 185 260 205 V230" />
          <path d="M170 60 V230" />
          <path d="M240 60 V150 Q240 165 255 165 H305" />
        </g>
      </g>

      {/* The shop's pin, with the route out to the phone */}
      <path
        d="M165 185 C165 230 230 235 300 228 S 420 225 400 262"
        fill="none"
        stroke={ORANGE}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="M165 185 L146 160 A27 27 0 1 1 184 160 Z" fill={INK} />
      <circle cx="165" cy="140" r="10" fill={ORANGE_SOFT} />

      {/* A hand holding a phone */}
      <path
        d="M318 300 L322 214 Q326 192 346 196 L388 206 Q404 211 400 230 L392 300 Z"
        fill={SKIN}
      />
      <rect
        x="320"
        y="52"
        width="92"
        height="170"
        rx="18"
        fill={INK}
        transform="rotate(8 366 137)"
      />
      <rect
        x="328"
        y="62"
        width="76"
        height="150"
        rx="12"
        fill={ORANGE_SOFT}
        transform="rotate(8 366 137)"
      />
      <rect
        x="352"
        y="68"
        width="28"
        height="7"
        rx="3.5"
        fill={INK}
        transform="rotate(8 366 137)"
      />
      <path d="M318 236 Q332 222 352 228 L356 246 Q338 250 322 258 Z" fill={SKIN_DARK} />

      {/* Where you're going: a big pin with tools in it */}
      <path d="M490 262 L438 190 A66 66 0 1 1 542 190 Z" fill={INK} />
      <circle cx="490" cy="150" r="46" fill={ORANGE} />
      <g stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none">
        <path d="M470 172 L506 136" />
        <path d="M500 126 a14 14 0 1 0 20 20" />
        <path d="M474 130 L508 166" />
      </g>
    </svg>
  );
}

export function ByMailIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 300" aria-hidden="true" className={className}>
      <ellipse cx="300" cy="262" rx="230" ry="14" fill="#e4e1d8" />

      {/* A taped-up box with a shipping label */}
      <path d="M90 140 L190 110 L290 140 L190 170 Z" fill="#c9915e" />
      <path d="M90 140 L190 170 V262 L90 232 Z" fill="#b07b4b" />
      <path d="M290 140 L190 170 V262 L290 232 Z" fill="#9a6a3f" />
      <path d="M140 125 L240 155" stroke="#e9c79f" strokeWidth="12" />
      <rect
        x="208"
        y="190"
        width="54"
        height="34"
        rx="4"
        fill="#fff"
        transform="skewY(-16) translate(0 62)"
      />
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" transform="skewY(-16) translate(0 62)">
        <path d="M216 200 H246" />
        <path d="M216 210 H238" />
      </g>

      {/* On its way */}
      <path
        d="M300 120 C340 70 380 70 410 100"
        fill="none"
        stroke={ORANGE}
        strokeWidth="6"
        strokeDasharray="2 14"
        strokeLinecap="round"
      />
      <path
        d="M404 82 L414 104 L392 108"
        fill="none"
        stroke={ORANGE}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The repair ticket, with the tools for it */}
      <rect
        x="380"
        y="112"
        width="150"
        height="150"
        rx="10"
        fill="#fff"
        transform="rotate(5 455 187)"
      />
      <g transform="rotate(5 455 187)">
        <rect x="398" y="132" width="40" height="10" rx="5" fill={ORANGE} />
        <rect x="398" y="154" width="110" height="8" rx="4" fill="#ece9e2" />
        <rect x="398" y="172" width="90" height="8" rx="4" fill="#ece9e2" />
        <rect x="398" y="190" width="100" height="8" rx="4" fill="#ece9e2" />
      </g>
      <g strokeLinecap="round">
        <path d="M478 268 L518 160" stroke="#8b8f96" strokeWidth="16" />
        <path d="M510 168 a20 20 0 1 1 18 -36" stroke="#8b8f96" strokeWidth="14" fill="none" />
        <path d="M548 268 L556 196" stroke={INK} strokeWidth="18" />
        <path d="M556 196 L560 150" stroke="#c4c7cc" strokeWidth="6" />
      </g>
    </svg>
  );
}
