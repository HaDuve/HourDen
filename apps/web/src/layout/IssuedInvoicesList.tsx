import { useIsMobile } from "./use-is-mobile.js";

export type IssuedInvoice = {
  id: string;
  recipient: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
};

type IssuedInvoicesListProps = {
  invoices: IssuedInvoice[];
  downloadingId: string | null;
  onDownload: (invoice: IssuedInvoice) => void;
  formatBillingPeriod: (start: string, end: string) => string;
  formatAmount: (amount: number) => string;
};

export function IssuedInvoicesList({
  invoices,
  downloadingId,
  onDownload,
  formatBillingPeriod,
  formatAmount,
}: IssuedInvoicesListProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ul className="space-y-3">
        {invoices.map((invoice) => (
          <li
            key={invoice.id}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Recipient</dt>
                <dd className="text-right font-medium text-neutral-900">
                  {invoice.recipient}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Invoice Number</dt>
                <dd className="text-right text-neutral-900">
                  {invoice.invoiceNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Billing Period</dt>
                <dd className="text-right text-neutral-700">
                  {formatBillingPeriod(invoice.periodStart, invoice.periodEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Total</dt>
                <dd className="text-right text-neutral-700">
                  {formatAmount(invoice.totalAmount)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => onDownload(invoice)}
              disabled={downloadingId === invoice.id}
              aria-label={`Download invoice ${invoice.invoiceNumber}`}
              className="mt-4 min-h-11 w-full rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {downloadingId === invoice.id ? "Downloading…" : "Download"}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-700">
          <tr>
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Invoice Number</th>
            <th className="px-4 py-3 font-medium">Billing Period</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-t border-neutral-200">
              <td className="px-4 py-3 text-neutral-900">{invoice.recipient}</td>
              <td className="px-4 py-3 text-neutral-900">
                {invoice.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {formatBillingPeriod(invoice.periodStart, invoice.periodEnd)}
              </td>
              <td className="px-4 py-3 text-neutral-700">
                {formatAmount(invoice.totalAmount)}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onDownload(invoice)}
                  disabled={downloadingId === invoice.id}
                  aria-label={`Download invoice ${invoice.invoiceNumber}`}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {downloadingId === invoice.id ? "Downloading…" : "Download"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
