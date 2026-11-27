import { useEffect, useRef, type ReactNode } from "react";

// A window over the page, with the page dimmed behind it.
//
// Built on <dialog>/showModal() rather than a positioned div: the browser
// then keeps focus inside it, closes it on Escape, and makes the page
// behind inert for screen readers — all things a hand-rolled overlay has to
// reimplement and usually gets partly wrong.
let openModals = 0;

function lockScroll() {
  openModals += 1;
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  openModals = Math.max(0, openModals - 1);
  if (openModals === 0) document.body.style.overflow = "";
}

export function Modal({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The page behind shouldn't scroll under the window — on a phone, a
  // swipe that misses the window would otherwise scroll the page instead.
  // Counted rather than saved-and-restored: windows stack (Send Request
  // opens over the flow it came from) and close together, and the second
  // one to open would otherwise "restore" the first one's lock.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      // Escape closes the native dialog itself; this keeps our state in step.
      onClose={onClose}
      // A click on the dimmed area lands on the <dialog> element itself
      // (its box covers the screen); a click inside lands on a child.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="flex min-h-full items-end justify-center sm:items-center"
      >
        <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-ink hover:bg-black/10"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </dialog>
  );
}
