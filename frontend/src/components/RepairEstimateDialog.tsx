import { useState } from "react";
import { Modal } from "./Modal";
import {
  DevicePicker,
  LabeledSelect,
  LabeledTextarea,
  deviceLabel,
  NO_DEVICE,
  modelOf,
  type DeviceChoice,
} from "./DevicePicker";
import { REPAIR_PRICES, REPAIR_SERVICES, type RepairService } from "../data/repairPrices";
import { SendRequestDialog, type RequestDraft } from "./SendRequestDialog";
import { formatPrice } from "../lib/format";

// "Repair a Device" → Get started: pick the device, then see what each
// repair costs for it. Two steps rather than one long form, so the first
// thing on screen is a single question.
export function RepairEstimateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"device" | "estimate">("device");
  const [choice, setChoice] = useState<DeviceChoice>(NO_DEVICE);
  const model = modelOf(choice);
  // Which repair they're after. Required, and "Other" needs a description
  // of the problem — a request that just says "Other" can't be quoted or
  // even replied to usefully.
  const [service, setService] = useState("");
  const [issue, setIssue] = useState("");
  const [requesting, setRequesting] = useState(false);
  const isOther = service === "Other";
  const ready = !!service && (!isOther || issue.trim().length > 0);

  const draft: RequestDraft = {
    service: "repair",
    device: deviceLabel(choice),
    service_requested: service,
    details: isOther
      ? [`Issue: ${issue.trim()}`, "Estimate: Contact for pricing"]
      : service
        ? [`Estimate: ${priceFor(model, service as RepairService)}`]
        : [],
  };

  function close() {
    onClose();
    // Next time opens at the start, but keeps the device: someone checking
    // a second repair for the same phone shouldn't pick it all again.
    setStep("device");
  }

  return (
    <>
      <Modal open={open} onClose={close} label="Repair estimate">
        {step === "device" ? (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              Choose your device
            </h2>
            <div className="mt-8">
              <DevicePicker value={choice} onChange={setChoice} />
            </div>
            <button
              type="button"
              disabled={!model}
              onClick={() => setStep("estimate")}
              className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              See estimate
            </button>
          </div>
        ) : (
          <div className="px-6 pt-12 pb-8 sm:px-10">
            <h2 className="text-center text-2xl font-semibold text-ink sm:text-3xl">
              How much will it cost?
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

            <div className="mt-8">
              <LabeledSelect
                label="Service needed"
                value={service}
                onChange={setService}
                placeholder="Select a service"
                options={[...REPAIR_SERVICES, "Other"]}
              />
            </div>
            {isOther && (
              <div className="mt-4">
                <LabeledTextarea
                  label="Describe the issue"
                  value={issue}
                  onChange={setIssue}
                  placeholder="What's going on with your device?"
                  maxLength={400}
                />
              </div>
            )}

            <p className="mt-8 text-sm text-muted">Estimated service cost</p>
            <dl className="mt-2">
              {REPAIR_SERVICES.map((service) => (
                <CostRow key={service} label={service} value={priceFor(model, service)} />
              ))}
              {/* Always quoted case by case — "other" covers too much to price. */}
              <CostRow label="Other" value="Contact for pricing" />
            </dl>

            <button
              type="button"
              disabled={!ready}
              onClick={() => setRequesting(true)}
              className="mt-8 w-full rounded-full bg-brand px-7 py-3 text-lg font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send Request
            </button>
            {!ready && (
              <p className="mt-3 text-center text-sm text-muted">
                {isOther
                  ? "Describe the issue to send a request."
                  : "Choose the service you need to send a request."}
              </p>
            )}

            <p className="mt-6 text-center text-sm leading-relaxed text-muted">
              We&apos;ll inspect your device to confirm the final price before any work starts. A
              shipping fee may be added if your device is mailed in.
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

function priceFor(model: string, service: RepairService) {
  const cents = REPAIR_PRICES[model]?.[service];
  return cents != null ? formatPrice(cents) : "Contact for pricing";
}

// Shared with the Unlock window, so both price lists read the same.
export function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/10 py-3 text-lg text-ink">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
