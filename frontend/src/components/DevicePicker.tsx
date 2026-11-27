import { useId } from "react";
import {
  DEVICE_TYPES,
  IPAD_LINES,
  IPHONE_MODELS,
  OTHER,
  type DeviceType,
} from "../data/repairDevices";

// "Which device is it?" — the first step for repairing, unlocking or selling
// one, so it lives here once rather than in each of those flows. Controlled:
// the choice is held by whoever shows it, so stepping forward and back
// again doesn't lose what was picked.

export type DeviceChoice = {
  deviceType: DeviceType | "";
  // A picked list entry (an iPhone) or, for iPads, the line.
  picked: string;
  ipadGeneration: string;
  // Whatever's typed, when the model isn't in a list.
  typed: string;
};

export const NO_DEVICE: DeviceChoice = {
  deviceType: "",
  picked: "",
  ipadGeneration: "",
  typed: "",
};

// Where the "Help identify your model" link goes for each device type.
// Only Apple's own guides; MacBook and Other get none rather than a guess.
const IDENTIFY_URLS: Partial<Record<DeviceType, string>> = {
  iPhone: "https://support.apple.com/HT201296",
  iPad: "https://support.apple.com/HT201471",
};

function ipadLineOf(choice: DeviceChoice) {
  return choice.deviceType === "iPad"
    ? IPAD_LINES.find((l) => l.name === choice.picked)
    : undefined;
}

// What to type in, if anything: a label for the text box, or null when the
// model comes from a list.
function typeInFor(choice: DeviceChoice): { label: string; placeholder: string } | null {
  const line = ipadLineOf(choice);
  if (choice.deviceType === "Other") return { label: "Your device", placeholder: "Make and model" };
  if (choice.deviceType === "MacBook")
    return { label: "Your MacBook", placeholder: 'e.g. MacBook Air 13" (M2)' };
  if (choice.deviceType === "iPhone" && choice.picked === OTHER)
    return { label: "Your iPhone", placeholder: "e.g. iPhone 5c" };
  if (line && (!line.models || choice.ipadGeneration === OTHER))
    return {
      label: `Your ${line.name}`,
      placeholder:
        line.name === "iPad Pro" ? 'e.g. iPad Pro 11" (M4)' : "e.g. iPad (3rd generation)",
    };
  return null;
}

/** The model the choice comes to — a list entry, or what was typed — or "" if not there yet. */
export function modelOf(choice: DeviceChoice): string {
  if (typeInFor(choice)) return choice.typed.trim();
  if (choice.deviceType === "iPhone") return choice.picked;
  if (ipadLineOf(choice)?.models) return choice.ipadGeneration;
  return "";
}

/** How the device reads in a request: "iPhone / iPhone 15 Pro". */
export function deviceLabel(choice: DeviceChoice): string {
  return `${choice.deviceType} / ${modelOf(choice)}`;
}

export function DevicePicker({
  value,
  onChange,
  listsOnly = false,
  iPhoneOther = false,
  appleOnly = false,
}: {
  value: DeviceChoice;
  onChange: (next: DeviceChoice) => void;
  // Only what's in the lists: no "Other" anywhere and nothing typed in.
  // For unlocking, where whether it can be done depends on the exact
  // model, so a free-text answer couldn't be given one.
  listsOnly?: boolean;
  // With listsOnly, still offer "Other" (typed in) at the bottom of the
  // iPhone list. For unlocking: an iPhone older than the list is the kind
  // that can be done, so it shouldn't be turned away for not being listed.
  iPhoneOther?: boolean;
  // No "Other" device type, for flows that only take Apple devices. The
  // "Other" at the bottom of a model list stays: an older or odd Apple
  // model can still be typed in.
  appleOnly?: boolean;
}) {
  const ipadLine = ipadLineOf(value);
  const iPhoneTypeIn = value.deviceType === "iPhone" && value.picked === OTHER;
  const typeIn = !listsOnly || (iPhoneOther && iPhoneTypeIn) ? typeInFor(value) : null;
  const withOther = (options: readonly string[]) =>
    listsOnly ? options.filter((o) => o !== OTHER) : [...options, OTHER];
  const identifyUrl = value.deviceType ? IDENTIFY_URLS[value.deviceType] : undefined;

  return (
    <div>
      <div className="space-y-4">
        <LabeledSelect
          label="Device Type"
          value={value.deviceType}
          // A new type starts over: an iPhone model means nothing for an iPad.
          onChange={(v) => onChange({ ...NO_DEVICE, deviceType: v as DeviceType })}
          placeholder="Select a device type"
          options={
            appleOnly
              ? DEVICE_TYPES.filter((t) => t !== OTHER)
              : withOther(DEVICE_TYPES.filter((t) => t !== OTHER))
          }
        />

        {value.deviceType === "iPhone" && (
          <LabeledSelect
            label="Model"
            value={value.picked}
            onChange={(v) => onChange({ ...value, picked: v, typed: "" })}
            placeholder="Select your iPhone"
            options={iPhoneOther ? [...IPHONE_MODELS, OTHER] : withOther(IPHONE_MODELS)}
          />
        )}

        {value.deviceType === "iPad" && (
          <LabeledSelect
            label="Model"
            value={value.picked}
            onChange={(v) => onChange({ ...value, picked: v, ipadGeneration: "", typed: "" })}
            placeholder="Select your iPad"
            options={IPAD_LINES.map((l) => l.name)}
          />
        )}

        {ipadLine?.models && (
          <LabeledSelect
            label="Generation"
            value={value.ipadGeneration}
            onChange={(v) => onChange({ ...value, ipadGeneration: v, typed: "" })}
            placeholder={`Select your ${ipadLine.name}`}
            options={withOther(ipadLine.models)}
          />
        )}

        {typeIn && (
          <LabeledInput
            label={typeIn.label}
            value={value.typed}
            onChange={(v) => onChange({ ...value, typed: v })}
            placeholder={typeIn.placeholder}
          />
        )}
      </div>

      {identifyUrl && (
        <p className="mt-4 text-center">
          <a
            href={identifyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            Help identify your model &rsaquo;
          </a>
        </p>
      )}
    </div>
  );
}

const fieldBoxClass =
  "relative rounded-xl border border-black/30 bg-white px-4 pt-2 pb-2.5 focus-within:border-brand";

export function LabeledInput({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  autoComplete = "off",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: "text" | "tel";
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className={fieldBoxClass}>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        autoFocus
        maxLength={80}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-black/30"
      />
    </div>
  );
}

export function LabeledTextarea({
  label,
  value,
  placeholder,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  const id = useId();
  return (
    <div className={fieldBoxClass}>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        autoFocus
        rows={4}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-black/30"
      />
    </div>
  );
}

export function LabeledSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={`${fieldBoxClass} ${disabled ? "opacity-60" : ""}`}>
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent pr-8 text-lg text-ink outline-none disabled:cursor-not-allowed"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
