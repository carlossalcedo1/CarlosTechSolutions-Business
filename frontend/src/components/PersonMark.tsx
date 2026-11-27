// Head-and-shoulders mark for the admin login link in the header utility bar.
//
// Drawn the same way as MissionMark — `currentColor`, sized by className — so
// the two icons in that bar stay visually matched and both pick up the muted
// grey of the row and the brand colour on hover without either being told
// about colour explicitly.
export function PersonMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* head */}
      <circle cx="12" cy="8" r="3.6" />
      {/* shoulders */}
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
    </svg>
  );
}
