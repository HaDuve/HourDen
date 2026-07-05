import { Trans } from "react-i18next";
import { errorBannerClass } from "../layout/ui-classes.js";
import { BlockerLink } from "./BlockerLink.js";
import type { InvoiceAlert } from "./invoice-alert.js";
import {
  invoiceBlockerHref,
  invoiceBlockerMessageKey,
} from "./invoice-blocker-link.js";

type InvoiceAlertBannerProps = {
  alert: InvoiceAlert;
};

export function InvoiceAlertBanner({ alert }: InvoiceAlertBannerProps) {
  if (alert.kind === "plain") {
    return (
      <p className={`mb-4 ${errorBannerClass}`} role="alert">
        {alert.message}
      </p>
    );
  }

  const href = invoiceBlockerHref(alert.code, { clientId: alert.clientId });
  const linkClassName = "font-medium underline hover:text-danger";

  return (
    <p className={`mb-4 ${errorBannerClass}`} role="alert">
      <Trans
        i18nKey={invoiceBlockerMessageKey(alert.code)}
        components={{
          actionLink: (
            <BlockerLink to={href} className={linkClassName} />
          ),
        }}
      />
    </p>
  );
}
