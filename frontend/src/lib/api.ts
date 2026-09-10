/**
 * Thin wrapper around the five routes in backend/app/main.py (see
 * LAUNCH_CHECKLIST.md Phases 1 and 4). Every form goes through `post()` so a
 * change in error shape or base path is fixed in one place instead of
 * hunted down across four separate components.
 *
 * Requests go to a relative `/api/...` path, not an absolute backend URL —
 * Vite's dev proxy (vite.config.ts) forwards that to the backend locally,
 * and Caddy does the same in production (see LAUNCH_CHECKLIST.md Phase 5).
 * Same origin from the browser's point of view either way, so there's
 * nothing for CORS to even do here.
 */

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      // FastAPI validation errors are a list of {msg, loc, ...}; our own
      // HTTPException(detail=...) calls are a plain string. Handle both
      // rather than showing "[object Object]" for the former.
      if (Array.isArray(data?.detail)) {
        message =
          data.detail
            .map((d: { msg?: string }) => d.msg)
            .filter(Boolean)
            .join(" ") || message;
      } else if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Body wasn't JSON — keep the generic status-code message.
    }
    throw new ApiError(message);
  }

  return res.json() as Promise<T>;
}

export function checkout(itemId: string) {
  return post<{ url: string }>("/checkout", { item_id: itemId });
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  repair_type?: string;
  device_brand?: string;
  imei?: string;
}

export function submitContact(payload: ContactPayload) {
  return post<{ ok: boolean }>("/contact", payload);
}

export interface TradeInPayload {
  name: string;
  email: string;
  phone?: string;
  imei: string;
  condition: string;
  unlock_status: string;
  notes?: string;
}

export function submitTradeIn(payload: TradeInPayload) {
  return post<{ ok: boolean }>("/trade-in", payload);
}

export function subscribe(email: string) {
  return post<{ ok: boolean }>("/subscribe", { email });
}
