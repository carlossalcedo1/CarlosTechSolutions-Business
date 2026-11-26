import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAdminSession, adminLogout } from "./api";

// Who's signed in to the admin panel.
//
// A context rather than a hook that fetches per caller: the header asks on
// every page and the sign-in page asks too, and two components mounting the
// same hook would mean two /api/admin/me requests on every navigation. One
// fetch at the root, shared.
//
// The session cookie is httponly, so the browser can't read it directly —
// asking the server is the only way to know, which is the whole point of
// httponly and the reason `loading` below has to exist.

export type AdminUser = {
  username: string;
};

export type AdminSession = {
  user: AdminUser | null;
  /** True until the first /api/admin/me answers. Not the same as signed
   *  out, and rendering it as if it were is what makes a header flash
   *  "Log in" for a moment before correcting itself. */
  loading: boolean;
  /** Re-ask the server. Called after a successful sign-in, which is what
   *  makes the header update without a page reload. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: next } = await getAdminSession();
      setUser(next);
    } catch {
      // A failed request means we don't know, and "don't know" has to read
      // as signed out — anything else would show an admin greeting on a
      // page the server never confirmed.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      // Clear locally whatever the server said. If the call failed the row
      // may still be alive, but showing someone as signed in after they
      // asked to leave is the worse of the two wrongs, and the next
      // refresh will correct it either way.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminSessionContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSession {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    // Throwing rather than returning a signed-out default: a component
    // rendered outside the provider would otherwise silently claim nobody
    // is signed in, which is exactly the bug you'd never think to look for.
    throw new Error("useAdminSession must be used inside <AdminSessionProvider>");
  }
  return ctx;
}
