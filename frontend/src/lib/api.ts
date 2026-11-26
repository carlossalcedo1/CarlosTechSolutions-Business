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
 * Step one of admin sign-in: push an 8-digit code to the admin's phone.
 *
 *   POST /api/admin/login   { "username": "cmsal06" }
 *     200  { "ok": true }
 *     400  "Username has not been registered."   (not on ADMIN_USERNAMES)
 *     503  couldn't reach Pushover
 *     429  rate limited
 *
 * `post()` surfaces FastAPI's `detail` as the ApiError message, so the copy
 * for every one of those lives in backend/app/main.py and this side just
 * shows what it's told.
 */
export function requestAdminLoginCode(username: string) {
  return post<{ ok: boolean }>("/admin/login", { username });
}

/**
 * Step two: trade the code for a session — eventually.
 *
 *   POST /api/admin/verify  { "username": "cmsal06", "code": "04172905" }
 *     200  { "ok": true }
 *     400  "That code isn't valid. Request a new one."
 *     422  code wasn't 8 digits (rejected before it costs an attempt)
 *
 * A 200 here means the code was real and has now been burned. It does NOT
 * mean anyone is signed in: the route returns a bare ok because there's no
 * admin panel yet to hold a session open, and useAdminSession still reports
 * signed out. Issuing a token is the next piece, and it belongs with the
 * panel that needs one.
 */
export function verifyAdminLoginCode(username: string, code: string) {
  return post<{ ok: boolean }>("/admin/verify", { username, code });
}
