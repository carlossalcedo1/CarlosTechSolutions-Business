import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RepairEstimateDialog } from "../components/RepairEstimateDialog";
import { UnlockDialog } from "../components/UnlockDialog";
import { SellOfferDialog } from "../components/SellOfferDialog";
import { ByMailIllustration, InPersonIllustration } from "../components/ServiceIllustrations";

// One page for the three things people come in for. The pills swap what's
// below them rather than linking off, so the page reads as one place to
// start; the choice is kept in the URL (?service=unlock) so a link can open
// straight to the right one.

type ServiceKey = "unlock" | "repair" | "sell";

const SERVICES: { key: ServiceKey; label: string }[] = [
  { key: "unlock", label: "Unlock a Device" },
  { key: "repair", label: "Repair a Device" },
  { key: "sell", label: "Sell a Device" },
];

function isServiceKey(value: string | null): value is ServiceKey {
  return SERVICES.some((s) => s.key === value);
}

export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("service");
  // Repair is the default: it's the one with the most to show on this page.
  const active: ServiceKey = isServiceKey(requested) ? requested : "repair";

  // Get started opens the estimate in a window over the page, rather than
  // unfolding it into the page: the help and service info stay where they
  // are behind it, and closing it puts you back exactly where you were.
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  function choose(key: ServiceKey) {
    const next = new URLSearchParams(searchParams);
    next.set("service", key);
    // replace: flipping between pills shouldn't fill the back button.
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="pb-20">
      <section className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Services</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink sm:text-xl">
          Cracked screen? Bad battery? Or simply want to get rid of that old phone? We&apos;ll give
          you a competitive offer or quote in minutes.
        </p>

        <ServicePills active={active} onChoose={choose} />
      </section>

      {active === "repair" && (
        <>
          <HereToHelp
            action={<GetStartedButton onClick={() => setEstimateOpen(true)} />}
            cost={
              <>
                <span className="font-semibold">Cost:</span> $25/hour + parts, or $40/hour for
                complex repairs
              </>
            }
            note="Currently, we're only repairing Apple devices until further notice."
            footnote={
              <>
                Simple repairs: display, battery, glass. Complex repairs: housing, charging port.
                <br />
                85% of repairs take under an hour. Time past 0.3 hours (18 minutes) is rounded up to
                the full hour, and we&apos;ll contact you if any complications come up.
              </>
            }
          >
            To get started, tell us what&apos;s going on with your device. We&apos;ll show you what
            a repair costs, or help you arrange a repair or replacement.
          </HereToHelp>
          <WhereToGetService />
          <WhyNexFix />
          <RepairEstimateDialog open={estimateOpen} onClose={() => setEstimateOpen(false)} />
        </>
      )}

      {active === "unlock" && (
        <HereToHelp
          action={<GetStartedButton onClick={() => setUnlockOpen(true)} />}
          note="We only unlock Apple devices."
        >
          To get started, tell us about the device you need unlocked. We&apos;ll verify it&apos;s
          yours, then let you know what it takes to get it working again.
        </HereToHelp>
      )}
      {active === "unlock" && (
        <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      )}

      {active === "sell" && (
        <HereToHelp
          action={<GetStartedButton onClick={() => setSellOpen(true)} />}
          note="Currently, we only buy Apple devices until further notice."
        >
          To get started, tell us what you have. We&apos;ll give you a competitive offer in minutes,
          then you can ship it in or drop it off.
        </HereToHelp>
      )}
      {active === "sell" && <SellOfferDialog open={sellOpen} onClose={() => setSellOpen(false)} />}
    </div>
  );
}

function ServicePills({
  active,
  onChoose,
}: {
  active: ServiceKey;
  onChoose: (key: ServiceKey) => void;
}) {
  return (
    // On a phone the three share the width evenly and a label may wrap to
    // two lines; all three on one line don't fit in 343px, and a control
    // that scrolls sideways hides the first or last choice.
    <div className="mt-10 flex justify-center">
      <div
        role="tablist"
        aria-label="Services"
        className="grid w-full grid-cols-3 rounded-full bg-black/[0.07] p-1 sm:inline-flex sm:w-auto"
      >
        {SERVICES.map((s) => {
          const selected = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChoose(s.key)}
              className={`rounded-full px-2 py-2 text-sm leading-tight transition-colors sm:px-6 sm:py-2.5 sm:text-base sm:whitespace-nowrap ${
                selected ? "bg-ink text-white" : "text-ink hover:bg-black/[0.05]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HereToHelp({
  children,
  action,
  note,
  cost,
  footnote,
}: {
  children: ReactNode;
  action: ReactNode;
  note?: string;
  // The rate, shown between the intro and the red note.
  cost?: ReactNode;
  // A small line under the button.
  footnote?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-16 text-center">
      {/* The mark on a dark tile, the way an app icon sits: the orange and
          its shading carry better on near-black than on white. */}
      <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[28%] bg-night shadow-sm">
        <img
          src="/logo-80.png"
          srcSet="/logo-80.png 1x, /logo-160.png 2x, /logo-240.png 3x"
          alt=""
          width={80}
          height={80}
          className="h-20 w-20"
        />
      </div>
      <h2 className="mt-10 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        We&apos;re here to help.
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-ink">{children}</p>
      {cost && <p className="mt-4 text-lg text-ink">{cost}</p>}
      {note && <p className="mt-3 text-sm font-medium text-red-700">{note}</p>}
      <div className="mt-6">{action}</div>
      {footnote && <p className="mt-4 text-xs leading-relaxed text-muted">{footnote}</p>}
    </section>
  );
}

const getStartedClass =
  "inline-block rounded-full bg-brand px-8 py-3 text-lg font-medium text-white hover:bg-brand-dark";

function GetStartedButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={getStartedClass}>
      Get started
    </button>
  );
}

function WhereToGetService() {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-20">
      <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Where can I get service?
      </h2>

      <ServiceOption
        title="In Person"
        art={<InPersonIllustration className="h-auto w-full" />}
        tint="bg-[#fdeee2]"
      >
        You can get personal support in Gainesville, or I can come to you for a fee: gas plus $5 per
        hour of travel time.
      </ServiceOption>

      <ServiceOption
        title="By Mail"
        art={<ByMailIllustration className="h-auto w-full" />}
        tint="bg-[#f3f1ec]"
      >
        Mail your device in for repair, on your schedule and without an appointment. Text us first
        and we&apos;ll send you the address and what to pack.
      </ServiceOption>
    </section>
  );
}

function ServiceOption({
  title,
  art,
  tint,
  children,
}: {
  title: string;
  art: ReactNode;
  tint: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-10 text-center">
      <div className={`overflow-hidden rounded-3xl px-4 py-6 ${tint}`}>{art}</div>
      <h3 className="mt-8 text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-ink">{children}</p>
    </div>
  );
}

function WhyNexFix() {
  return (
    <section className="mx-auto max-w-2xl px-4 pt-20 text-center">
      <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Why choose NexFix?</h2>

      <Reason icon={<CheckIcon />} title="It's easy.">
        We keep repairs simple from beginning to end. We&apos;ll help you find the most convenient
        way to get service, give you an estimate up front, and keep you informed the whole way
        through.
      </Reason>

      <Reason icon={<ShieldIcon />} title="It's private.">
        <Link to="/privacy" className="text-brand underline hover:text-brand-dark">
          NexFix cares about your privacy
        </Link>
        , and we only touch what we need to repair and test your device — your photos, messages and
        accounts stay yours.
      </Reason>

      <Reason
        icon={
          <span className="flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#8e8e93]">
            <img
              src="/logo-80.png"
              srcSet="/logo-80.png 1x, /logo-160.png 2x, /logo-240.png 3x"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12"
            />
          </span>
        }
        title="It's backed by us."
      >
        Full transparency on every repair: before any work starts, we tell you exactly which parts
        go into your device and what each one costs. With options at every price point, there&apos;s
        a repair that fits your budget — and you always know what you&apos;re paying for.
      </Reason>
    </section>
  );
}

function Reason({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-12 flex flex-col items-center">
      {icon}
      <h3 className="mt-6 text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-lg leading-relaxed text-ink">{children}</p>
    </div>
  );
}

// Outline icons in the grey Apple uses for these, sized to match the logo
// ring above so the three read as a set.
function CheckIcon() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="h-24 w-24" fill="none" stroke="#8e8e93">
      <circle cx="48" cy="48" r="44" strokeWidth="5" />
      <path d="M32 50 L44 62 L66 34" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="h-24 w-24">
      <path
        d="M48 8 L80 20 V46 C80 66 66 80 48 88 C30 80 16 66 16 46 V20 Z"
        fill="none"
        stroke="#8e8e93"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M48 8 L16 20 V46 C16 66 30 80 48 88 Z" fill="#8e8e93" />
    </svg>
  );
}
