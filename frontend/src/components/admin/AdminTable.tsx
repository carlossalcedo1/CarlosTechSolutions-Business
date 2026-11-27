import type { ReactNode } from "react";

// The table Orders and Codes both use, so the two tabs read the same.
//
// It's a real <table> from sm up and a stack of cards below that. A phone
// can't fit five columns plus a column of buttons: either the text wraps to
// one word per line or the table scrolls sideways, and either way the
// buttons — the thing you came to press — end up off the right edge. As
// cards, each row's actions sit full-width underneath it instead.

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Extra classes for this column's cells on the wide layout. */
  className?: string;
};

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  actions,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline px-6 py-10 text-center text-sm text-muted">
        {empty}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-hairline sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className="px-4 py-3 font-medium">
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-middle">
                {columns.map((c) => (
                  <td key={c.header} className={`px-4 py-3 text-ink ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-2xl border border-hairline p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {columns.map((c) => (
                <div key={c.header} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="text-right text-ink">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-3 flex flex-col gap-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Small, table-sized versions of the panel's pill buttons. */
export function RowButton({
  tone = "black",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "black" | "outline" }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "black"
          ? "bg-ink text-white hover:opacity-90"
          : "border border-hairline bg-white text-ink hover:border-ink"
      } ${className}`}
    />
  );
}

export const rowLinkClass =
  "inline-flex items-center justify-center rounded-full border border-hairline bg-white px-4 py-2 text-[13px] font-medium whitespace-nowrap text-ink transition hover:border-ink";

export function StatusPill({ tone, children }: { tone: "green" | "grey" | "orange"; children: ReactNode }) {
  const tones = {
    green: "bg-green-50 text-green-800 ring-green-200",
    grey: "bg-black/5 text-muted ring-black/10",
    orange: "bg-brand/10 text-brand ring-brand/20",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}
