// Clipboard writes, including the awkward one: copying something the server
// hasn't sent yet.
//
// Browsers only let a page write to the clipboard during a user gesture —
// the tap itself. Safari on iOS is the strictest: once the page awaits a
// network request, the gesture is over and writeText() is refused. So
// "tap Generate, then copy the code that comes back" fails on an iPhone if
// done the obvious way.
//
// ClipboardItem accepts a *promise* for its contents. Writing one during the
// tap claims the clipboard while the gesture is still live, and the browser
// fills it in when the promise resolves. That's the path tried first; plain
// writeText afterwards is the fallback for browsers without it, and the
// panel always shows a Copy button as the last resort.

/** Copy text that's already in hand. Call from a click handler. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy text that's still on its way. Must be called synchronously inside
 * the gesture's handler — before any `await` — or it's no better than
 * copyText. Never rejects; resolves false if nothing was copied.
 */
export async function copyWhenReady(text: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // Unsupported, or the text failed to arrive — fall through.
  }
  try {
    return await copyText(await text);
  } catch {
    return false;
  }
}
