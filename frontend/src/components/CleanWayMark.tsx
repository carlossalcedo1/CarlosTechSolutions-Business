// Small leaf mark that sits beside "The Clean Way" everywhere the name
// appears — header, footer, homepage section, About page — so the sourcing
// story reads as one named thing across the site.
//
// It draws with `currentColor`, so it picks up whatever text color it sits
// in: muted grey in the header, white on the dark homepage section. Size it
// with the className (em units keep it proportional inside headings).
export function CleanWayMark({ className = "" }: { className?: string }) {
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
      {/* leaf body */}
      <path d="M20.5 3.5c0 9.4-5.2 15.5-12.4 15.5A4.6 4.6 0 0 1 3.5 14.4C3.5 7.9 10.2 3.5 20.5 3.5Z" />
      {/* stem / vein */}
      <path d="M5.5 20.5c1.8-5.6 5.2-9.6 10.2-12" />
    </svg>
  );
}
