import { useState } from "react";
import { Modal } from "./Modal";
import { CostRow } from "./RepairEstimateDialog";
import {
  DevicePicker,
  deviceLabel,
  LabeledSelect,
  NO_DEVICE,
  modelOf,
  type DeviceChoice,
} from "./DevicePicker";
import {
  BATTERY,
  CONDITIONS,
  LOCK_STATUS,
  NO_ANSWERS,
  answered,
  offerFor,
  type SellAnswers,
} from "../data/sellPrices";
import { SendRequestDialog, type RequestDraft } from "./SendRequestDialog";
import { formatPrice } from "../lib/format";

// "Sell a Device" → Get started: the device, then a few questions about
// its state, one at a time, ending in an offer. Each question appears once
// the one before it is answered, so the window never opens on a wall of
// dropdowns, and the offer is the last thing to show up.

const YES_NO = ["No", "Yes"];

// The selects show labels; answers store the short values.
function labelOf<T extends { value: string; label: string }>(list: readonly T[], value: string) {
  return list.find((o) => o.value === value)?.label ?? "";
}
function valueOf<T extends { value: string; label: string }>(list: readonly T[], label: string) {
  return list.find((o) => o.label === label)?.value ?? "";
}

export function SellOfferDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"device" | "questions">("device");
  const [choice, setChoice] = useState<DeviceChoice>(NO_DEVICE);
  const [a, setA] = useState<SellAnswers>(NO_ANSWERS);
  const model = modelOf(choice);

  function close() {
    onClose();
    setStep("device");
  }

  function update(changes: Partial<SellAnswers>) {
    setA((prev) => ({ ...prev, ...changes }));
  }

  const condition = CONDITIONS.find((c) => c.value === a.condition);
  const asksCracks = a.condition === "C";
  // Where the guided questions have got to.
  const cracksDone = !asksCracks || (!!a.crackedFront && !!a.crackedBack);
  const done = answered(a);
  const offer = done ? offerFor(model, a) : null;

  const [requesting, setRequesting] = useState(false);
  const draft: RequestDraft = {
    service: "sell",
    device: deviceLabel(choice),
    details: [
      condition && `Condition: ${condition.label}`,
      asksCracks && `Cracked front: ${a.crackedFront === "yes" ? "Yes" : "No"}`,
      asksCracks && `Cracked back: ${a.crackedBack === "yes" ? "Yes" : "No"}`,
      a.battery && `Battery health: ${labelOf(BATTERY, a.battery)}`,
      a.lock && `Lock status: ${labelOf(LOCK_STATUS, a.lock)}`,
      `Estimated offer: ${offer != null ? formatPrice(offer) : "none — needs a quote"}`,
    ].filter((d): d is string => !!d),
  };

  return (
    <>
      <Modal open={open} onClose={close} label="Sell a device">
        {step === "device" ? (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              Choose your device
            </h2>
            <div className="mt-8">
              <DevicePicker
                value={choice}
                onChange={(next) => {
                  setChoice(next);
                  // A different device starts the questions over.
                  setA(NO_ANSWERS);
                }}
                appleOnly
              />
            </div>
            <button
              type="button"
              disabled={!model}
              onClick={() => setStep("questions")}
              className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              Tell us about it
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

            <div className="mt-8 space-y-4">
              <div>
                <LabeledSelect
                  label="Condition"
                  value={labelOf(CONDITIONS, a.condition)}
                  onChange={(label) =>
                    // Changing condition clears the crack answers: they only
                    // mean something for C.
                    update({
                      condition: valueOf(CONDITIONS, label) as SellAnswers["condition"],
                      crackedFront: "",
                      crackedBack: "",
                    })
                  }
                  placeholder="Select a condition"
                  options={CONDITIONS.map((c) => c.label)}
                />
                {/* What each grade means, right where you're choosing — then
                  out of the way once you have, so the next question is
                  what's in front of you. */}
                {!condition && (
                  <dl className="mt-3 space-y-2 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm leading-relaxed text-ink">
                    {CONDITIONS.map((c) => (
                      <div key={c.value}>
                        <dt className="inline font-bold">{c.label}</dt>
                        <dd className="inline"> — {c.detail}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              {asksCracks && (
                <LabeledSelect
                  label="Cracked front?"
                  value={a.crackedFront === "" ? "" : a.crackedFront === "yes" ? "Yes" : "No"}
                  onChange={(v) => update({ crackedFront: v === "Yes" ? "yes" : "no" })}
                  placeholder="Is the front glass cracked?"
                  options={YES_NO}
                />
              )}
              {asksCracks && a.crackedFront && (
                <LabeledSelect
                  label="Cracked back?"
                  value={a.crackedBack === "" ? "" : a.crackedBack === "yes" ? "Yes" : "No"}
                  onChange={(v) => update({ crackedBack: v === "Yes" ? "yes" : "no" })}
                  placeholder="Is the back glass cracked?"
                  options={YES_NO}
                />
              )}

              {a.condition && cracksDone && (
                <LabeledSelect
                  label="Battery Health"
                  value={labelOf(BATTERY, a.battery)}
                  onChange={(label) =>
                    update({
                      battery: valueOf(BATTERY, label) as SellAnswers["battery"],
                    })
                  }
                  placeholder="Settings › Battery › Battery Health"
                  options={BATTERY.map((b) => b.label)}
                />
              )}

              {a.battery && cracksDone && (
                <LabeledSelect
                  label="Lock Status"
                  value={labelOf(LOCK_STATUS, a.lock)}
                  onChange={(label) =>
                    update({
                      lock: valueOf(LOCK_STATUS, label) as SellAnswers["lock"],
                    })
                  }
                  placeholder="Select lock status"
                  options={LOCK_STATUS.map((l) => l.label)}
                />
              )}
            </div>

            {done && (
              <>
                <div className="mt-8 rounded-2xl bg-black/[0.04] px-5 pt-4 pb-1">
                  <p className="text-sm text-muted">Estimated offer</p>
                  <dl className="mt-1 [&>div:last-child]:border-b-0">
                    <CostRow
                      label="We'll pay"
                      value={offer != null ? formatPrice(offer) : "We'll text you an offer"}
                    />
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() => setRequesting(true)}
                  className="mt-6 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark"
                >
                  Send Request
                </button>

                <p className="mt-6 text-center text-sm leading-relaxed text-muted">
                  Your final offer is confirmed once we&apos;ve inspected the device.
                </p>
              </>
            )}
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
