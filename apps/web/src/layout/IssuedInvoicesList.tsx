import { useTranslation } from "react-i18next";
import {
  cardClass,
  metaTextClass,
  secondaryButtonClass,
} from "./ui-classes.js";
import { mobileSecondaryButtonClass } from "./tap-targets.js";
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
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const downloadButtonClass = isMobile
    ? `${mobileSecondaryButtonClass(true)} w-full`
    : secondaryButtonClass;

  if (isMobile) {
    return (
      <ul className="space-y-3">
        {invoices.map((invoice) => (
          <li
            key={invoice.id}
            className={`${cardClass} p-4`}
          >
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("invoices.recipient")}</dt>
                <dd className="text-right font-medium text-content">
                  {invoice.recipient}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("invoices.invoiceNumber")}</dt>
                <dd className="text-right text-content">
                  {invoice.invoiceNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("invoices.billingPeriod")}</dt>
                <dd className={`text-right ${metaTextClass}`}>
                  {formatBillingPeriod(invoice.periodStart, invoice.periodEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("invoices.total")}</dt>
                <dd className={`text-right ${metaTextClass}`}>
                  {formatAmount(invoice.totalAmount)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => onDownload(invoice)}
              disabled={downloadingId === invoice.id}
              aria-label={t("invoices.downloadInvoice", {
                number: invoice.invoiceNumber,
              })}
              className={`mt-4 ${downloadButtonClass}`}
            >
              {downloadingId === invoice.id
                ? t("invoices.downloading")
                : t("invoices.download")}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-divider">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-hover text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">{t("invoices.recipient")}</th>
            <th className="px-4 py-3 font-medium">{t("invoices.invoiceNumber")}</th>
            <th className="px-4 py-3 font-medium">{t("invoices.billingPeriod")}</th>
            <th className="px-4 py-3 font-medium">{t("invoices.total")}</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">{t("invoices.download")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-t border-divider">
              <td className="px-4 py-3 text-content">{invoice.recipient}</td>
              <td className="px-4 py-3 text-content">
                {invoice.invoiceNumber}
              </td>
              <td className={`px-4 py-3 ${metaTextClass}`}>
                {formatBillingPeriod(invoice.periodStart, invoice.periodEnd)}
              </td>
              <td className={`px-4 py-3 ${metaTextClass}`}>
                {formatAmount(invoice.totalAmount)}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onDownload(invoice)}
                  disabled={downloadingId === invoice.id}
                  aria-label={t("invoices.downloadInvoice", {
                    number: invoice.invoiceNumber,
                  })}
                  className="rounded-md border border-secondary-border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-content hover:bg-secondary-hover disabled:opacity-50"
                >
                  {downloadingId === invoice.id
                    ? t("invoices.downloading")
                    : t("invoices.download")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
