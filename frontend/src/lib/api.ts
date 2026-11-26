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

import type { CodeLookup } from "../types";

export class ApiError extends Error {}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await request(path);
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

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

// Public and read-only — see backend/app/main.py's /api/sold-items — so the
// static-built catalog can show "Sold" instead of silently staying
// available until the next deploy.
export function getSoldItemIds() {
  return get<{ sold_item_ids: string[] }>("/sold-items").then((r) => r.sold_item_ids);
}

export function checkout(itemId: string) {
  return post<{ url: string }>("/checkout", { item_id: itemId });
}

// Code-only listings (backend/app/codes.py). The lookup's 404 message is
// shown to the buyer as-is, so it's read here rather than through get().
export async function lookupCode(code: string): Promise<CodeLookup> {
  const res = await request(`/codes/${encodeURIComponent(code)}`);
  if (res.ok) return res.json() as Promise<CodeLookup>;
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") message = data.detail;
  } catch {
    // Not JSON — keep the generic message.
  }
  throw new ApiError(message);
}

export function checkoutCode(code: string) {
  return post<{ url: string }>("/checkout", { code });
}

export interface ContactPayload {
  name: string;
  email?: string;
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
  carrier?: string;
  battery_health?: string;
  notes?: string;
}

export function submitTradeIn(payload: TradeInPayload) {
  return post<{ ok: boolean }>("/trade-in", payload);
}

export function subscribe(email: string) {
  return post<{ ok: boolean }>("/subscribe", { email });
}

/**
 * Step one of admin sign-in: ask the backend to send a confirmation code.
 *
 * THE ENDPOINT DOESN'T EXIST YET. The UI is built against this contract so
 * that standing the route up is the only thing left to do:
 *
 *   POST /api/admin/login   { "username": "carlos" }
 *     200  { "ok": true }                     code sent, show the "check your
 *                                             phone" state
 *     4xx  { "detail": "<message>" }          shown to the user verbatim
 *
 * For a username that isn't on the allowlist, `detail` must be exactly
 * "Username has not been registered." — `post()` above surfaces FastAPI's
 * `detail` string as the ApiError message, so whatever the server says is
 * what the user reads, and the page doesn't special-case it.
 *
 * Delivery is Pushover, not email: app/notifier.py's send_push already does
 * the whole job in one stdlib POST. Two things to watch when wiring it up,
 * though, because neither is obvious:
 *
 *   - send_push targets settings.pushover_user_key, which is a single fixed
 *     key — the owner's. That's fine while one person signs in. For a second
 *     admin the allowlist has to map username -> that admin's own user key,
 *     because Pushover addresses a device, not a name this app made up.
 *   - send_push logs failures and returns instead of raising. That's correct
 *     where it's used now (inside the Stripe webhook, where raising would
 *     make Stripe retry a handled sale) and wrong here: a swallowed failure
 *     would show "code sent" for a code that was never delivered. This route
 *     needs to know whether delivery actually happened, so it wants a
 *     variant that raises, or a return value it can check.
 *
 * Worth deciding too: answering "registered" vs "not registered" tells anyone
 * who asks which usernames are admins. Less leaky than it was with email
 * addresses, but it's still the reason this route wants a tight per-IP rate
 * limit (app/ratelimit.py).
 */
export function requestAdminLoginCode(username: string) {
  return post<{ ok: boolean }>("/admin/login", { username });
}
