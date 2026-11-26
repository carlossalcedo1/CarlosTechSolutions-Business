import { AdminPageHeader, AdminEmptyState } from "../../components/AdminLayout";
import { useAdminSession } from "../../lib/useAdminSession";

// Account settings. The first real thing to land here is passkey enrolment,
// which is the one piece of the sign-in work that has nowhere to live until
// this page exists.
export function AdminSettingsPage() {
  const { user } = useAdminSession();

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Your account and how you sign in."
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">Account</h2>
        <dl className="mt-3 divide-y divide-hairline border-y border-hairline text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Username</dt>
            <dd className="font-medium text-ink">{user?.username}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Sign-in method</dt>
            <dd className="text-ink">Confirmation code via Pushover</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Session length</dt>
            {/* Matches SESSION_DAYS in backend/app/sessions.py. Stated here
                because "why am I signed out again" is the question this
                page should be able to answer. */}
            <dd className="text-ink">3 days, then sign in again</dd>
          </div>
        </dl>
      </section>

      <AdminEmptyState title="Passkeys — not built yet">
        Enrolling a device with Face ID or Touch ID lands here.{" "}
        <code className="rounded bg-black/5 px-1 py-0.5">backend/app/passkeys.py</code>{" "}
        already stores and revokes credentials; nothing can create one yet, which is why the
        sign-in page still answers &ldquo;Not enrolled.&rdquo; Worth knowing before you
        start: a passkey only works on the domain it was created on, so enrol after the move
        to NexFixTech.com, not before.
      </AdminEmptyState>
    </div>
  );
}
