// House mark for the admin panel's way back to the shop.
//
// Same construction as MissionMark and PersonMark — `currentColor`, sized by
// className — so the icons in the admin nav match the ones in the site
// header without either being told about colour.
export function HomeMark({ className = "" }: { className?: string }) {
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
      {/* roof + walls as one stroke */}
      <path d="M3.6 10.4 12 3.8l8.4 6.6V19a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4Z" />
      {/* door */}
      <path d="M9.6 20.4v-6h4.8v6" />
    </svg>
  );
}
