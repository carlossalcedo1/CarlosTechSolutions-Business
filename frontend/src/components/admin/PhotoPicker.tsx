import { useCallback, useEffect, useRef, useState } from "react";

// The photo picker Create Listing and Generate Code share. One copy on
// purpose: the object-URL handling below is easy to get subtly wrong (see
// usePhotoPicker), and two copies would have to be got right twice.

export const MAX_PHOTOS = 10;

export type Photo = { file: File; url: string; key: string };

/**
 * Owns the chosen photos and their preview URLs.
 *
 * Object URLs hold the file in memory until revoked, and a phone tab that
 * leaks enough of them gets killed. They're revoked one at a time on
 * removal and the rest on unmount — NOT in an effect keyed on the photo
 * list, whose cleanup runs on every change and would revoke every preview
 * still on screen each time a photo was added or reordered, since the new
 * list reuses the same URLs. That's the bug this replaced.
 */
export function usePhotoPicker() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Side effects (creating and revoking URLs) happen here, outside the
  // setPhotos updaters. React's StrictMode runs updaters twice in
  // development and throws one result away, so a URL created inside one
  // would leak a full set of previews on every pick.
  const add = useCallback((list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photosRef.current.length;
    const incoming = Array.from(list)
      .slice(0, Math.max(room, 0))
      .map((file) => ({
        file,
        url: URL.createObjectURL(file),
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      }));
    setNotice(list.length > room ? `Only ${MAX_PHOTOS} photos fit — kept the first ${room}.` : null);
    setPhotos((prev) => [...prev, ...incoming]);
  }, []);

  const remove = useCallback((key: string) => {
    const gone = photosRef.current.find((p) => p.key === key);
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const makeCover = useCallback((key: string) => {
    setPhotos((prev) => {
      const chosen = prev.find((p) => p.key === key);
      return chosen ? [chosen, ...prev.filter((p) => p.key !== key)] : prev;
    });
  }, []);

  const clear = useCallback(() => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setNotice(null);
  }, []);

  /** Appended in display order: the server numbers them 1.jpg, 2.jpg… in
   *  the order they arrive, and 1.jpg is the cover. */
  const appendTo = useCallback(
    (form: FormData) => photosRef.current.forEach((p) => form.append("photos", p.file, p.file.name)),
    [],
  );

  return { photos, notice, add, remove, makeCover, clear, appendTo };
}

export function PhotoPicker({
  picker,
  coverHint = "The first photo is the cover.",
}: {
  picker: ReturnType<typeof usePhotoPicker>;
  coverHint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { photos, notice, add, remove, makeCover } = picker;

  return (
    <section>
      <p className="text-sm font-medium text-ink">Photos</p>
      <p className="mt-1 text-xs text-muted">
        {coverHint} HEIC is fine — everything is converted to JPEG, turned upright and resized.
      </p>

      {photos.length > 0 && (
        <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.key} className="relative overflow-hidden rounded-lg border border-hairline">
              <PhotoThumb photo={p} />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">
                {i === 0 ? "Cover" : i + 1}
              </span>
              <div className="flex border-t border-hairline text-xs">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(p.key)}
                    className="flex-1 py-2 text-ink hover:bg-black/5"
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="flex-1 py-2 text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {notice && <p className="mt-2 text-xs text-red-700">{notice}</p>}

      {photos.length < MAX_PHOTOS && (
        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-hairline px-4 py-6 text-[15px] font-medium text-ink hover:border-ink">
          {/* No `capture` attribute on purpose: it forces the camera open and
              skips the photo library, and the photos are usually already
              taken. Without it a phone offers both. */}
          <input
            ref={input}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={(e) => {
              add(e.target.files);
              // Reset so picking the same photo again still fires onChange.
              if (input.current) input.current.value = "";
            }}
            className="sr-only"
          />
          {photos.length === 0 ? "Add photos" : "Add more photos"}
        </label>
      )}
    </section>
  );
}

/** A preview, or the filename when the browser can't draw it — desktop
 *  Chrome can't render HEIC, though the server converts it fine. */
function PhotoThumb({ photo }: { photo: Photo }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex aspect-square items-center justify-center bg-surface p-2 text-center text-[11px] break-all text-muted">
        {photo.file.name}
      </div>
    );
  }
  return (
    <img
      src={photo.url}
      alt=""
      onError={() => setBroken(true)}
      className="aspect-square w-full bg-surface object-cover"
    />
  );
}

/**
 * Wait until a just-saved photo is actually being served, giving up after
 * about three seconds either way.
 *
 * Vite's dev server keeps a list of public/ files and only learns about a
 * new one from its file watcher, which lags the write. Ask for the photo in
 * the meantime and Vite answers 200 with index.html — its SPA fallback — so
 * a card would show a broken image for a photo that saved perfectly.
 * (Measured: text/html straight after the write, image/jpeg a second
 * later.) A failed <img> load isn't cached, so retrying is enough.
 */
export function imageReady(src: string, attempts = 12, delayMs = 250): Promise<void> {
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        if (++tries >= attempts) resolve();
        else setTimeout(attempt, delayMs);
      };
      img.src = src;
    };
    attempt();
  });
}
