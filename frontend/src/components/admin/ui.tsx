import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

// Small building blocks for the admin panel's forms, so the List page's
// flows look and behave alike without each one restating the same classes.

const pillBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

const pillTone = {
  black: "bg-ink text-white hover:opacity-90",
  orange: "bg-brand text-white hover:bg-brand-dark",
  outline: "border border-hairline bg-white text-ink hover:border-ink",
} as const;

type Tone = keyof typeof pillTone;

export function PillButton({
  tone = "black",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  // type="button" unless told otherwise: an unqualified <button> inside a
  // form submits it, which is how a "Back" button ends up saving.
  return (
    <button
      type="button"
      {...props}
      className={`${pillBase} ${pillTone[tone]} ${className}`}
    />
  );
}

export function PillLink({
  to,
  tone = "black",
  children,
  className = "",
}: {
  to: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={`${pillBase} ${pillTone[tone]} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * Inputs on these screens are 16px, not the 14px the shop's forms use.
 * iOS Safari zooms the whole page in when you focus a field smaller than
 * 16px and doesn't zoom back out, which on a form you fill in from a phone
 * means fighting the layout on every field.
 */
export const inputClass =
  "mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-brand";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {error}
    </p>
  );
}

/** "← Back to List" — every flow's way out, in the same place. */
export function BackToList() {
  return (
    <Link to="/admin/list" className="inline-block text-sm text-muted hover:text-ink">
      &larr; Back to List
    </Link>
  );
}
