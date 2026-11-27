import { useState, type ComponentType } from "react";
import { Modal } from "./Modal";
import { CostRow } from "./RepairEstimateDialog";
import { DevicePicker, deviceLabel, NO_DEVICE, modelOf, type DeviceChoice } from "./DevicePicker";
import { HelloScreen, HomeScreen, PasscodeScreen } from "./LockScreenMockups";
import { canUnlock } from "../data/unlockEligibility";
import { OTHER } from "../data/repairDevices";
import { SendRequestDialog, type RequestDraft } from "./SendRequestDialog";
import { formatPrice } from "../lib/format";

// "Unlock a Device" → Get started: which device, whether it can be done,
// and what it shows when you turn it on. The answer to "can it be done?"
// comes the moment the device is picked, so nobody gets as far as texting
// about a phone that can't be unlocked.

// The price depends only on what the screen shows, not the model: the
// model has already decided whether it can be done at all. Each comes with
// what the unlocked device will and won't do, shown before anyone texts,
// so nobody pays for an unlock expecting something it doesn't give.
const NO_RESET = "The device cannot be factory reset.";

const SCREENS: {
  key: string;
  caption: string;
  Picture: ComponentType;
  priceCents: number;
  notes: string[];
}[] = [
  {
    key: "hello",
    caption: "Hello screen",
    Picture: HelloScreen,
    priceCents: 1500,
    notes: [
      "Cellular service will not work — you won't be able to make or receive calls.",
      "iCloud features (iMessage, FaceTime, iCloud sync) will not work.",
      "The App Store and downloading apps will work as normal.",
      "Everything else on the device will work as normal.",
    ],
  },
  {
    key: "passcode",
    caption: "Passcode lock",
    Picture: PasscodeScreen,
    priceCents: 2000,
    notes: [NO_RESET],
  },
  {
    key: "home",
    caption: "Opens to the home screen",
    Picture: HomeScreen,
    priceCents: 2000,
    notes: [NO_RESET],
  },
];

type Verdict = "macbook" | "cannot" | "ok" | null;

function verdictFor(choice: DeviceChoice): Verdict {
  if (choice.deviceType === "MacBook") return "macbook";
  // iPad Pro has no list to pick from, and none can be done, so it's
  // answered as soon as the line is chosen.
  if (choice.deviceType === "iPad" && choice.picked === "iPad Pro") return "cannot";
  const model = modelOf(choice);
  if (!model) return null;
  // A typed-in iPhone isn't in the list to check against — usually one
  // older than the 5s. It goes through, and the request shows what was
  // typed, so you make the call when you reply.
  if (choice.deviceType === "iPhone" && choice.picked === OTHER) return "ok";
  return canUnlock(model) ? "ok" : "cannot";
}

export function UnlockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"device" | "screen">("device");
  const [choice, setChoice] = useState<DeviceChoice>(NO_DEVICE);
  const [screen, setScreen] = useState("");
  const verdict = verdictFor(choice);
  const model = modelOf(choice);
  const shown = SCREENS.find((s) => s.key === screen);

  function close() {
    onClose();
    setStep("device");
  }

  const [requesting, setRequesting] = useState(false);
  const draft: RequestDraft = {
    service: "unlock",
    device: deviceLabel(choice),
    service_requested: shown ? `${shown.caption} unlock` : undefined,
    details: shown ? [`Price: ${formatPrice(shown.priceCents)}`] : [],
  };

  return (
    <>
      <Modal open={open} onClose={close} label="Unlock a device">
        {step === "device" ? (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              Choose your device
            </h2>
            <div className="mt-8">
              <DevicePicker value={choice} onChange={setChoice} listsOnly iPhoneOther />
            </div>

            {verdict === "macbook" && <Refusal>We are currently not unlocking MacBooks.</Refusal>}
            {verdict === "cannot" && (
              <Refusal>Cannot be currently unlocked. Try again later.</Refusal>
            )}

            <button
              type="button"
              disabled={verdict !== "ok"}
              onClick={() => setStep("screen")}
              className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              What do you see when you turn it on?
            </h2>
            <p className="mt-2 text-center text-muted">
              {model}{" "}
              <button
                type="button"
                onClick={() => setStep("device")}
                className="text-brand hover:underline"
              >
                Change
              </button>
            </p>

            <div
              role="radiogroup"
              aria-label="What the screen shows"
              className="mt-8 grid grid-cols-3 gap-3 sm:gap-5"
            >
              {SCREENS.map(({ key, caption, Picture, priceCents }) => {
                const selected = key === screen;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setScreen(key)}
                    className={`rounded-2xl border-2 p-2 text-center transition-colors sm:p-3 ${
                      selected
                        ? "border-brand bg-white"
                        : "border-transparent hover:bg-black/[0.04]"
                    }`}
                  >
                    <Picture />
                    <span className="mt-3 block text-sm leading-tight text-ink">{caption}</span>
                    <span className="mt-1 block text-sm font-semibold text-ink">
                      {formatPrice(priceCents)}
                    </span>
                  </button>
                );
              })}
            </div>

            {shown && (
              <>
                {/* Price and disclaimers in separate boxes, so the notes read
                  as their own thing rather than small print under a price. */}
                <div className="mt-8 rounded-2xl bg-black/[0.04] px-5 pt-4 pb-1">
                  <p className="text-sm text-muted">Estimated service cost</p>
                  <dl className="mt-1 [&>div:last-child]:border-b-0">
                    <CostRow
                      label={`${shown.caption} unlock`}
                      value={formatPrice(shown.priceCents)}
                    />
                  </dl>
                </div>

                <div className="mt-4 rounded-2xl bg-black/[0.04] px-5 py-4">
                  <h3 className="font-semibold text-ink">
                    {shown.notes.length === 1 ? "Disclaimer" : "Disclaimers"}
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
                    {shown.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {shown ? (
              <button
                type="button"
                onClick={() => setRequesting(true)}
                className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark"
              >
                Send Request
              </button>
            ) : (
              <p className="mt-8 text-center text-sm text-muted">Pick the one that matches.</p>
            )}

            <p className="mt-6 text-center text-sm leading-relaxed text-muted">
              We&apos;ll verify the device is yours before any unlock.
            </p>
          </div>
        )}
      </Modal>
      <SendRequestDialog
        open={requesting}
        draft={draft}
        onClose={() => setRequesting(false)}
        onSent={() => {
          setRequesting(false);
          close();
        }}
      />
    </>
  );
}

function Refusal({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-6 text-center font-medium text-red-700">
      {children}
    </p>
  );
}
