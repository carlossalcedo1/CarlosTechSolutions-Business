import { useCallback, useEffect, useRef, useState } from "react";
import { getDeployStatus, startDeploy, ApiError, type DeployStatus } from "../../lib/api";
import { PillButton, ErrorNote } from "./ui";

// The Deploy button: runs deploy/deploy.sh, the same script add_item.py and
// sold_item.py offer to run when they finish. Nothing the panel changes
// reaches the shop until this runs — the catalog is built into both the
// frontend bundle and the API image — so the panel says so plainly and
// keeps this button close to every change.

const POLL_MS = 2000;

export function DeployPanel({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getDeployStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't check deploy status.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll only while something is running. A deploy takes minutes, and the
  // request that started it returned immediately — this is how the panel
  // finds out it finished.
  const running = status?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, refresh]);

  // Keep the newest log line in view as it streams.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  async function go() {
    setConfirming(false);
    setError(null);
    try {
      await startDeploy();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the deploy.");
    }
  }

  if (!status) {
    return <div className="h-14" aria-hidden />;
  }

  const finished = status.status === "succeeded" || status.status === "failed" || status.status === "unknown";

  return (
    <section
      className={`rounded-2xl border px-5 py-4 ${
        status.pendingDeploy ? "border-brand-bright bg-brand/5" : "border-hairline bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {running
              ? "Deploying…"
              : status.pendingDeploy
                ? "You have changes that aren't live yet."
                : "Everything you've changed here is live."}
          </p>
          {!compact && !running && (
            <p className="mt-0.5 text-sm text-muted">
              Runs deploy.sh — tests, rebuild, restart. A few minutes; the shop may blink
              briefly.
            </p>
          )}
        </div>

        {status.available ? (
          <PillButton
            tone="orange"
            disabled={running}
            onClick={() => setConfirming(true)}
            className="shrink-0"
          >
            {running ? "Deploying…" : "Deploy"}
          </PillButton>
        ) : (
          <p className="text-sm text-muted">
            Deploy isn&apos;t available here — this server is the deployed container.
          </p>
        )}
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border border-hairline bg-surface p-4">
          <p className="text-sm text-ink">
            Deploy now? This runs the tests, rebuilds the site and restarts it. If the tests
            fail, nothing changes on the live site.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PillButton tone="orange" onClick={() => void go()}>
              Yes, deploy
            </PillButton>
            <PillButton tone="outline" onClick={() => setConfirming(false)}>
              Cancel
            </PillButton>
          </div>
        </div>
      )}

      <div className="mt-3">
        <ErrorNote error={error} />
      </div>

      {finished && (
        <p
          className={`mt-3 text-sm font-medium ${
            status.status === "succeeded"
              ? "text-green-700"
              : status.status === "failed"
                ? "text-red-700"
                : "text-muted"
          }`}
        >
          {status.status === "succeeded" && "Last deploy succeeded."}
          {status.status === "failed" &&
            `Last deploy failed (exit ${status.exitCode}). Nothing changed on the live site.`}
          {status.status === "unknown" &&
            "The last deploy finished while the server was restarting, so its result wasn't captured — check the log."}
        </p>
      )}

      {(running || (finished && status.log.length > 0)) && (
        <pre
          ref={logRef}
          className="mt-3 max-h-64 overflow-auto rounded-lg bg-night p-3 text-xs leading-relaxed text-white/80"
        >
          {status.log.join("\n") || "Starting…"}
        </pre>
      )}
    </section>
  );
}
