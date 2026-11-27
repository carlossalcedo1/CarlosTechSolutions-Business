import { useCallback, useEffect, useState } from "react";
import { getAdminInventory, ApiError, type AdminInventory } from "../../../lib/api";

/**
 * The catalog as it is on disk right now — not the copy baked into the
 * shop's bundle. That's the point of reading it through the API: a listing
 * created or edited here shows in the panel immediately, before it's
 * deployed, where the bundled copy wouldn't change until the next build.
 */
export function useAdminInventory() {
  const [data, setData] = useState<AdminInventory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await getAdminInventory());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the catalog.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading: data === null && error === null, reload };
}
