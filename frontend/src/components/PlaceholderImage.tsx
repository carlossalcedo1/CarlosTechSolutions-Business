// Stage 1 has no real product photography yet (Cloudinary + image sync is
// a Stage 2 item per the brief). This renders the same gray box the
// wireframes use, so swapping in real <img> tags later is a small,
// isolated change in one place.
export function PlaceholderImage({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-100 text-xs text-gray-400 ${className}`}
    >
      {label ?? "Image coming soon"}
    </div>
  );
}
