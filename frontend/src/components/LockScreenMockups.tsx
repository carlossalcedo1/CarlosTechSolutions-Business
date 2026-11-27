import type { ReactNode } from "react";

// Illustrations, not screenshots: hand-drawn SVG versions of the two lock
// states Our Mission talks about, so the About page can show what "locked"
// actually looks like. Swap in real photos of your own devices any time.

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";

function StatusBar({ light = false }: { light?: boolean }) {
  const color = light ? "#fff" : "#000";
  return (
    <g fill={color}>
      <text x="52" y="45" fontSize="15" fontWeight="600">
        9:41
      </text>
      {[4, 6.5, 9, 11.5].map((h, i) => (
        <rect key={h} x={206 + i * 5} y={45 - h} width="3" height={h} rx="1" />
      ))}
      <rect x="236" y="35" width="22" height="11" rx="3" fill="none" stroke={color} strokeOpacity="0.5" />
      <rect x="238" y="37" width="15" height="7" rx="1.5" />
      <rect x="259" y="38.5" width="2" height="4" rx="1" fillOpacity="0.5" />
    </g>
  );
}

function HomeIndicator({ light = false }: { light?: boolean }) {
  return <rect x="100" y="590" width="100" height="5" rx="2.5" fill={light ? "#fff" : "#000"} />;
}

/** Phone body + screen. `screen` is the screen's fill (a color or a gradient url). */
function Phone({ label, screen, children }: { label: string; screen: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 300 620"
      role="img"
      aria-label={label}
      className="h-auto w-full drop-shadow-lg"
      style={{ fontFamily: FONT }}
    >
      <rect width="300" height="620" rx="50" fill="#1c1c1e" />
      <rect x="3" y="3" width="294" height="614" rx="47" fill="none" stroke="#3a3a3c" strokeWidth="2" />
      <rect x="12" y="12" width="276" height="596" rx="40" fill={screen} />
      {children}
      {/* Dynamic Island, drawn last so it sits on top of the screen content. */}
      <rect x="112" y="24" width="76" height="24" rx="12" fill="#000" />
    </svg>
  );
}

function ActivationLockScreen() {
  const body = [
    "Activation Lock prevents anyone who",
    "is not the owner from using this iPhone.",
    "",
    "To unlock this iPhone, enter the Apple",
    "Account and password that were used",
    "during setup.",
  ];
  return (
    <Phone label="iPhone showing the iCloud Activation Lock screen" screen="#fff">
      <StatusBar />
      <text x="30" y="92" fontSize="15" fill="#007aff">
        ‹ Back
      </text>
      <text x="270" y="92" fontSize="15" fill="#c7c7cc" textAnchor="end">
        Next
      </text>

      <path d="M141 134v-7a9 9 0 0 1 18 0v7" fill="none" stroke="#007aff" strokeWidth="4" />
      <rect x="135" y="132" width="30" height="23" rx="4" fill="#007aff" />

      <text x="150" y="192" fontSize="17" fontWeight="600" fill="#000" textAnchor="middle">
        iPhone Locked to Owner
      </text>
      <text fontSize="10.5" fill="#3c3c43" textAnchor="middle">
        {body.map((line, i) => (
          <tspan key={i} x="150" y={216 + i * 14}>
            {line}
          </tspan>
        ))}
      </text>
      <text x="150" y="306" fontSize="10.5" fontWeight="600" fill="#3c3c43" textAnchor="middle">
        j••••••@icloud.com
      </text>

      <rect x="30" y="324" width="240" height="76" rx="10" fill="#f2f2f7" />
      <line x1="42" y1="362" x2="270" y2="362" stroke="#d1d1d6" />
      <text x="44" y="348" fontSize="12" fill="#8e8e93">
        Email or Phone Number
      </text>
      <text x="44" y="386" fontSize="12" fill="#8e8e93">
        Password
      </text>

      <text x="150" y="432" fontSize="12" fill="#007aff" textAnchor="middle">
        Unlock with Passcode?
      </text>
      <HomeIndicator />
    </Phone>
  );
}

// [digit, letters] in keypad order; the last row is just 0, centered.
const KEYS: Array<[string, string]> = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["0", ""],
];

export function PasscodeScreen() {
  return (
    <Phone label="iPhone showing the Enter Passcode lock screen" screen="url(#passcode-bg)">
      <defs>
        <linearGradient id="passcode-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#6b6b70" />
          <stop offset="0.55" stopColor="#3a3a3e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
      </defs>
      <StatusBar light />

      <path d="M144 94v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <rect x="140" y="93" width="20" height="15" rx="3" fill="#fff" />
      <text x="150" y="142" fontSize="16" fill="#fff" textAnchor="middle">
        Enter Passcode
      </text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={100 + i * 20} cy="166" r="5" fill="none" stroke="#fff" strokeWidth="1.5" />
      ))}

      {KEYS.map(([digit, letters], i) => {
        const cx = i === 9 ? 150 : 85 + (i % 3) * 65;
        const cy = 228 + Math.floor(i / 3) * 66;
        return (
          <g key={digit} fill="#fff" textAnchor="middle">
            <circle cx={cx} cy={cy} r="28" fillOpacity="0.18" />
            <text x={cx} y={letters ? cy + 3 : cy + 9} fontSize="26">
              {digit}
            </text>
            {letters && (
              <text x={cx} y={cy + 15} fontSize="7" fontWeight="600" letterSpacing="1">
                {letters}
              </text>
            )}
          </g>
        );
      })}

      <text x="44" y="552" fontSize="14" fill="#fff">
        Emergency
      </text>
      <text x="256" y="552" fontSize="14" fill="#fff" textAnchor="end">
        Cancel
      </text>
      <HomeIndicator light />
    </Phone>
  );
}

// The setup screen a reset or locked device greets you with.
export function HelloScreen() {
  return (
    <Phone label="iPhone showing the hello setup screen" screen="url(#hello-bg)">
      <defs>
        <linearGradient id="hello-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef1f6" />
        </linearGradient>
        <linearGradient id="hello-ink" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2b6cf0" />
          <stop offset="0.5" stopColor="#b44be1" />
          <stop offset="1" stopColor="#f2554a" />
        </linearGradient>
      </defs>
      <StatusBar />
      <text
        x="150"
        y="320"
        fontSize="68"
        fontWeight="300"
        fontStyle="italic"
        fill="url(#hello-ink)"
        textAnchor="middle"
      >
        hello
      </text>
      <text x="150" y="555" fontSize="14" fill="#8e8e93" textAnchor="middle">
        Swipe up to open
      </text>
      <HomeIndicator />
    </Phone>
  );
}

// Unlocked as far as the home screen — apps and all.
const APP_COLORS = [
  "#34c759",
  "#0a84ff",
  "#ff9f0a",
  "#ff375f",
  "#5e5ce6",
  "#64d2ff",
  "#ffd60a",
  "#30d158",
  "#bf5af2",
  "#ff453a",
  "#8e8e93",
  "#0a84ff",
  "#ff9f0a",
  "#34c759",
  "#5e5ce6",
  "#ff375f",
  "#64d2ff",
  "#ffd60a",
  "#30d158",
  "#bf5af2",
];

export function HomeScreen() {
  return (
    <Phone label="iPhone showing the home screen" screen="url(#home-bg)">
      <defs>
        <linearGradient id="home-bg" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#3b5bdb" />
          <stop offset="0.6" stopColor="#7048e8" />
          <stop offset="1" stopColor="#c2255c" />
        </linearGradient>
      </defs>
      <StatusBar light />
      {APP_COLORS.map((color, i) => (
        <rect
          key={i}
          x={34 + (i % 4) * 60}
          y={80 + Math.floor(i / 4) * 72}
          width="50"
          height="50"
          rx="12"
          fill={color}
        />
      ))}
      <rect x="22" y="506" width="256" height="76" rx="28" fill="#fff" fillOpacity="0.25" />
      {["#34c759", "#0a84ff", "#ffffff", "#ff9f0a"].map((color, i) => (
        <rect key={color} x={36 + i * 60} y="519" width="50" height="50" rx="12" fill={color} />
      ))}
      <HomeIndicator light />
    </Phone>
  );
}

const SCREENS = [
  { caption: "iCloud Activation Lock", Screen: ActivationLockScreen },
  { caption: "Passcode lock", Screen: PasscodeScreen },
];

export function LockScreenMockups({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 sm:gap-6 ${className}`}>
      {SCREENS.map(({ caption, Screen }) => (
        <figure key={caption}>
          <Screen />
          <figcaption className="mt-3 text-center text-xs text-muted sm:text-sm">{caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
