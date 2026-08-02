import { openMailto } from "./open-mailto.js";

/**
 * ADR-0014 Prepare Email side effects: download PDF for attach, then open mailto.
 * Download first so mailto same-document navigation cannot abort the PDF fetch.
 */
export async function deliverPrepareEmail(input: {
  mailtoHref: string;
  downloadPdf: () => Promise<void>;
  openMailto?: (href: string) => void;
}): Promise<void> {
  await input.downloadPdf();
  (input.openMailto ?? openMailto)(input.mailtoHref);
}
