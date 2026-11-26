// Who is signed in to the admin panel, as far as the UI is concerned.
//
// Nothing is signed in yet, because there is nothing to sign in to: the
// backend has no login endpoint, no session cookie and no user store. This
// deliberately returns a signed-out session so the header renders its
// logged-out branch, and so the "Hello, <name>" branch is written, typed and
// compiled now rather than being invented later under time pressure.
//
// When the admin panel is built, this function is the only thing that needs
// to change — return a user with a firstName and the header lights up on its
// own. Nothing else reads the session directly, on purpose.
//
// To see the signed-in design before any of that exists, temporarily return
// `{ user: { firstName: "Carlos" } }` from here; nothing else needs touching.

export type AdminUser = {
  /** Shown in the header as "Hello, <firstName>". */
  firstName: string;
};

export type AdminSession = {
  /** null means signed out. */
  user: AdminUser | null;
};

export function useAdminSession(): AdminSession {
  return { user: null };
}
